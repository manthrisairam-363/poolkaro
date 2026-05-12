-- Fix: Drop all versions of cancel_booking_and_restore
-- and recreate ONE clean version with no double-refund risk

DROP FUNCTION IF EXISTS cancel_booking_and_restore(uuid, uuid);

-- Also remove the old trigger that may cause double refund
DROP TRIGGER IF EXISTS on_booking_cancelled_refund ON bookings;
DROP FUNCTION IF EXISTS refund_on_cancel();

-- Single authoritative version
CREATE OR REPLACE FUNCTION cancel_booking_and_restore(
  p_booking_id UUID,
  p_user_id UUID
)
RETURNS jsonb AS $$
DECLARE
  v_booking bookings%ROWTYPE;
  v_cancel_count INTEGER;
  v_already_refunded BOOLEAN;
BEGIN
  SELECT * INTO v_booking FROM bookings
  WHERE id = p_booking_id AND rider_id = p_user_id AND status = 'confirmed';

  IF v_booking.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Booking not found');
  END IF;

  -- Check cancellations this month
  SELECT COUNT(*) INTO v_cancel_count FROM bookings
  WHERE rider_id = p_user_id AND status = 'cancelled'
    AND cancelled_at > NOW() - INTERVAL '30 days';

  -- Cancel booking
  UPDATE bookings SET status = 'cancelled', cancelled_at = NOW()
  WHERE id = p_booking_id;

  -- Restore seats
  UPDATE rides SET
    seats_available = LEAST(seats_total, seats_available + v_booking.seats_booked),
    status = 'active'
  WHERE id = v_booking.ride_id;

  -- Refund rider wallet ONCE (check not already refunded)
  SELECT EXISTS(
    SELECT 1 FROM wallet_transactions
    WHERE description LIKE '%' || p_booking_id::text || '%'
    AND type = 'refund'
  ) INTO v_already_refunded;

  IF NOT v_already_refunded THEN
    UPDATE wallets SET balance = balance + (v_booking.platform_fee * 100)
    WHERE user_id = p_user_id;
    INSERT INTO wallet_transactions(user_id, amount, type, description)
    VALUES (p_user_id, (v_booking.platform_fee * 100), 'refund',
      'Cancellation refund for booking ' || p_booking_id);
  END IF;

  -- Track cancellations
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
      THEN 'Frequent cancellations detected.' ELSE NULL END
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
