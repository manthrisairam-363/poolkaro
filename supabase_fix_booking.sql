-- FIX: Remove old triggers that conflict with book_ride_atomic RPC

-- Drop old seat-reduction triggers (these cause double deduction)
DROP TRIGGER IF EXISTS on_booking_confirmed ON bookings;
DROP TRIGGER IF EXISTS on_booking_created ON bookings;
DROP TRIGGER IF EXISTS booking_seat_update ON bookings;
DROP FUNCTION IF EXISTS confirm_booking();
DROP FUNCTION IF EXISTS update_seats_on_booking();

-- Also drop wallet deduction triggers (book_ride_atomic handles this too)
DROP TRIGGER IF EXISTS on_booking_wallet_deduct ON bookings;
DROP FUNCTION IF EXISTS wallet_deduct_on_booking();

-- Fix any rides that have wrong seat counts right now
-- Recalculate seats_available based on actual confirmed bookings
UPDATE rides r
SET seats_available = r.seats_total - COALESCE((
  SELECT SUM(b.seats_booked)
  FROM bookings b
  WHERE b.ride_id = r.id
  AND b.status = 'confirmed'
), 0)
WHERE r.status IN ('active', 'full');

-- Fix status (full vs active) based on corrected seat count
UPDATE rides
SET status = CASE
  WHEN seats_available <= 0 THEN 'full'
  ELSE 'active'
END
WHERE status IN ('active', 'full');

-- Verify fix
SELECT r.id, r.from_location, r.to_location, r.seats_total,
       r.seats_available,
       COUNT(b.id) as confirmed_bookings,
       SUM(b.seats_booked) as seats_booked
FROM rides r
LEFT JOIN bookings b ON b.ride_id = r.id AND b.status = 'confirmed'
WHERE r.status IN ('active', 'full')
GROUP BY r.id, r.from_location, r.to_location, r.seats_total, r.seats_available
ORDER BY r.created_at DESC
LIMIT 20;
