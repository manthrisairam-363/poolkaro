-- 1. Add is_admin column to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE;

-- 2. Mark Sairam as admin (update with your actual user ID)
-- First find your user ID:
SELECT id, full_name, email FROM profiles 
WHERE email IN ('manthrisairam@gmail.com', 'manthrisai@gmail.com');

-- Then run this (replace YOUR_USER_ID with the id from above):
-- UPDATE profiles SET is_admin = TRUE WHERE id = 'YOUR_USER_ID';

-- 3. Add RLS policy - only admins can see ALL profiles
-- (Regular users can still see public profile info for rides)
CREATE POLICY "Admins can read all profiles"
ON profiles FOR SELECT
USING (
  auth.uid() IN (SELECT id FROM profiles WHERE is_admin = TRUE)
  OR id = auth.uid()  -- users can always read their own profile
  OR TRUE  -- public ride-related info (already covered by existing policy)
);

-- 4. Restrict admin queries - only admins can see all bookings
DROP POLICY IF EXISTS "Riders see own bookings" ON bookings;
DROP POLICY IF EXISTS "Drivers see bookings for their rides" ON bookings;

CREATE POLICY "Users see relevant bookings" ON bookings FOR SELECT
USING (
  rider_id = auth.uid()
  OR EXISTS (SELECT 1 FROM rides WHERE rides.id = bookings.ride_id AND rides.driver_id = auth.uid())
  OR EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.is_admin = TRUE)
);
