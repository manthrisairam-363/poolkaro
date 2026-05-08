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
