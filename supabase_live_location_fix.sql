-- Fix live_locations table and RLS policies

-- Ensure table exists with correct structure
CREATE TABLE IF NOT EXISTS live_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  ride_id UUID NOT NULL REFERENCES rides(id) ON DELETE CASCADE,
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, ride_id)
);

ALTER TABLE live_locations ENABLE ROW LEVEL SECURITY;

-- Drop old policies
DROP POLICY IF EXISTS "Users manage own location" ON live_locations;
DROP POLICY IF EXISTS "Ride participants can see locations" ON live_locations;
DROP POLICY IF EXISTS "Users can share location" ON live_locations;

-- Anyone in the ride can read locations for that ride
CREATE POLICY "Ride participants read locations" ON live_locations
FOR SELECT USING (
  -- Own location
  user_id = auth.uid()
  OR
  -- Car owner of this ride
  EXISTS (
    SELECT 1 FROM rides
    WHERE rides.id = live_locations.ride_id
    AND rides.driver_id = auth.uid()
  )
  OR
  -- Confirmed rider of this ride
  EXISTS (
    SELECT 1 FROM bookings
    WHERE bookings.ride_id = live_locations.ride_id
    AND bookings.rider_id = auth.uid()
    AND bookings.status = 'confirmed'
  )
);

-- Users can insert/update/delete their own location
CREATE POLICY "Users manage own location" ON live_locations
FOR ALL USING (user_id = auth.uid());

-- Enable realtime on live_locations
ALTER PUBLICATION supabase_realtime ADD TABLE live_locations;
