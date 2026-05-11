-- Fix 1: Drop existing function to allow return type change
DROP FUNCTION IF EXISTS cancel_booking_and_restore(uuid,uuid);

-- Fix 2: Recreate with JSONB return type for fraud tracking
CREATE OR REPLACE FUNCTION cancel_booking_and_restore(
  p_booking_id UUID,
  p_user_id UUID
)
RETURNS jsonb AS $$
DECLARE
  v_booking bookings%ROWTYPE;
  v_cancel_count INTEGER;
BEGIN
  SELECT * INTO v_booking FROM bookings
  WHERE id = p_booking_id AND rider_id = p_user_id AND status = 'confirmed';
  IF v_booking.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Booking not found');
  END IF;
  SELECT COUNT(*) INTO v_cancel_count FROM bookings
  WHERE rider_id = p_user_id AND status = 'cancelled'
    AND cancelled_at > NOW() - INTERVAL '30 days';
  UPDATE bookings SET status = 'cancelled', cancelled_at = NOW() WHERE id = p_booking_id;
  UPDATE rides SET
    seats_available = LEAST(seats_total, seats_available + v_booking.seats_booked),
    status = 'active'
  WHERE id = v_booking.ride_id;
  UPDATE wallets SET balance = balance + (v_booking.platform_fee * 100) WHERE user_id = p_user_id;
  INSERT INTO wallet_transactions(user_id, amount, type, description)
  VALUES (p_user_id, (v_booking.platform_fee * 100), 'refund', 'Cancellation refund');
  UPDATE profiles SET
    cancellation_count = COALESCE(cancellation_count, 0) + 1,
    last_cancellation = NOW()
  WHERE id = p_user_id;
  IF v_cancel_count >= 4 THEN
    UPDATE profiles SET is_verified = FALSE WHERE id = p_user_id;
  END IF;
  RETURN jsonb_build_object(
    'success', true,
    'cancellation_count', v_cancel_count + 1,
    'warning', CASE WHEN v_cancel_count >= 3
      THEN 'Frequent cancellations detected. Account may be restricted.' ELSE NULL END
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fix 3: Atomic booking function
CREATE OR REPLACE FUNCTION book_ride_atomic(
  p_ride_id UUID,
  p_rider_id UUID,
  p_seats INTEGER DEFAULT 1
)
RETURNS JSONB AS $$
DECLARE
  v_ride rides%ROWTYPE;
  v_wallet_balance INTEGER;
  v_booking bookings%ROWTYPE;
  v_fee INTEGER := p_seats * 200;
BEGIN
  SELECT * INTO v_ride FROM rides WHERE id = p_ride_id FOR UPDATE;
  IF v_ride.status NOT IN ('active') THEN
    RETURN jsonb_build_object('success', false, 'message', 'Ride is no longer available');
  END IF;
  IF v_ride.seats_available < p_seats THEN
    RETURN jsonb_build_object('success', false, 'message', 'Not enough seats available');
  END IF;
  IF v_ride.driver_id = p_rider_id THEN
    RETURN jsonb_build_object('success', false, 'message', 'Cannot book your own ride');
  END IF;
  SELECT balance INTO v_wallet_balance FROM wallets WHERE user_id = p_rider_id FOR UPDATE;
  IF v_wallet_balance < v_fee THEN
    RETURN jsonb_build_object('success', false, 'message', 'Insufficient wallet balance. Add money to continue.');
  END IF;
  UPDATE wallets SET balance = balance - v_fee WHERE user_id = p_rider_id;
  UPDATE wallets SET balance = balance - v_fee WHERE user_id = v_ride.driver_id;
  INSERT INTO wallet_transactions(user_id, amount, type, description)
  VALUES (p_rider_id, -v_fee, 'booking_fee', 'Platform fee: ' || v_ride.from_location || ' → ' || v_ride.to_location);
  INSERT INTO wallet_transactions(user_id, amount, type, description)
  VALUES (v_ride.driver_id, -v_fee, 'posting_fee', 'Platform fee for confirmed booking');
  INSERT INTO bookings (
    ride_id, rider_id, seats_booked, ride_fare, platform_fee,
    driver_deduction, total_paid, driver_receives, payment_status, status
  ) VALUES (
    p_ride_id, p_rider_id, p_seats,
    v_ride.fare * p_seats, v_fee / 100, v_fee / 100,
    (v_ride.fare + (v_fee / 100)) * p_seats,
    (v_ride.fare - (v_fee / 100)) * p_seats,
    'paid', 'confirmed'
  ) RETURNING * INTO v_booking;
  UPDATE rides SET
    seats_available = seats_available - p_seats,
    status = CASE WHEN seats_available - p_seats <= 0 THEN 'full' ELSE 'active' END
  WHERE id = p_ride_id;
  RETURN jsonb_build_object('success', true, 'booking', row_to_json(v_booking));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fix 4: Wallet RLS — block delete
DROP POLICY IF EXISTS "Users see own wallet" ON wallets;
CREATE POLICY "Users can read own wallet" ON wallets FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own wallet" ON wallets FOR UPDATE USING (auth.uid() = user_id);

-- Fix 5: Add missing columns safely
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS cancellation_count INTEGER DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_cancellation TIMESTAMPTZ;
