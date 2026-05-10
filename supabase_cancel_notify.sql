-- Notify co-riders when car owner cancels ride
CREATE OR REPLACE FUNCTION cancel_ride_and_bookings(p_ride_id UUID, p_driver_id UUID)
RETURNS void AS $$
DECLARE
  v_ride rides%ROWTYPE;
  v_booking bookings%ROWTYPE;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM rides WHERE id = p_ride_id AND driver_id = p_driver_id) THEN
    RETURN;
  END IF;

  SELECT * INTO v_ride FROM rides WHERE id = p_ride_id;

  -- Notify each co-rider before cancelling
  FOR v_booking IN 
    SELECT * FROM bookings WHERE ride_id = p_ride_id AND status = 'confirmed'
  LOOP
    INSERT INTO notifications(user_id, title, message, type, ride_id)
    VALUES (
      v_booking.rider_id,
      '❌ Ride Cancelled',
      'Your ride from ' || v_ride.from_location || ' → ' || v_ride.to_location || ' has been cancelled by the car owner. ₹2 refunded to your wallet.',
      'cancellation',
      p_ride_id
    );
  END LOOP;

  -- Cancel all bookings
  UPDATE bookings SET status = 'cancelled', cancelled_at = NOW()
  WHERE ride_id = p_ride_id AND status = 'confirmed';

  -- Cancel ride
  UPDATE rides SET status = 'cancelled' WHERE id = p_ride_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Anti-fraud: Track cancellation patterns
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS cancellation_count INTEGER DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_cancellation TIMESTAMPTZ;

-- Function: cancel with fraud check
CREATE OR REPLACE FUNCTION cancel_booking_and_restore(
  p_booking_id UUID,
  p_user_id UUID
)
RETURNS jsonb AS $$
DECLARE
  v_booking bookings%ROWTYPE;
  v_cancel_count INTEGER;
BEGIN
  SELECT * INTO v_booking
  FROM bookings
  WHERE id = p_booking_id AND rider_id = p_user_id AND status = 'confirmed';

  IF v_booking.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Booking not found');
  END IF;

  -- Check cancellation count this month
  SELECT COUNT(*) INTO v_cancel_count
  FROM bookings
  WHERE rider_id = p_user_id
    AND status = 'cancelled'
    AND cancelled_at > NOW() - INTERVAL '30 days';

  -- Cancel booking
  UPDATE bookings
  SET status = 'cancelled', cancelled_at = NOW()
  WHERE id = p_booking_id;

  -- Restore seats
  UPDATE rides
  SET seats_available = LEAST(seats_total, seats_available + v_booking.seats_booked),
      status = 'active'
  WHERE id = v_booking.ride_id;

  -- Refund wallet (always refund for now, add restrictions later)
  UPDATE wallets
  SET balance = balance + (v_booking.platform_fee * 100)
  WHERE user_id = p_user_id;

  INSERT INTO wallet_transactions(user_id, amount, type, description)
  VALUES (p_user_id, (v_booking.platform_fee * 100), 'refund',
    'Cancellation refund — booking ' || p_booking_id);

  -- Track cancellation count
  UPDATE profiles
  SET cancellation_count = COALESCE(cancellation_count, 0) + 1,
      last_cancellation = NOW()
  WHERE id = p_user_id;

  -- Flag suspicious users (5+ cancellations in 30 days)
  IF v_cancel_count >= 4 THEN
    UPDATE profiles
    SET is_verified = FALSE
    WHERE id = p_user_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'cancellation_count', v_cancel_count + 1,
    'warning', CASE WHEN v_cancel_count >= 3
      THEN 'Frequent cancellations detected. Account may be restricted.'
      ELSE NULL END
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
