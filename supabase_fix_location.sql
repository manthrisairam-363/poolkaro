-- Fix live location policy so BOTH car owner and co-rider can see each other

-- Drop old policy
DROP POLICY IF EXISTS "Co-riders can see each others location" ON live_locations;

-- New policy: anyone involved in the ride can see all locations for that ride
CREATE POLICY "Ride participants see locations"
ON live_locations FOR SELECT
USING (
  -- Car owner of the ride
  EXISTS (
    SELECT 1 FROM rides
    WHERE rides.id = live_locations.ride_id
    AND rides.driver_id = auth.uid()
  )
  OR
  -- Co-rider who booked the ride
  EXISTS (
    SELECT 1 FROM bookings
    WHERE bookings.ride_id = live_locations.ride_id
    AND bookings.rider_id = auth.uid()
    AND bookings.status = 'confirmed'
  )
);

-- Also allow inserting/updating own location
DROP POLICY IF EXISTS "Users update own location" ON live_locations;
CREATE POLICY "Users manage own location"
ON live_locations FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
