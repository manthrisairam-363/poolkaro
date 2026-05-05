-- =============================================
-- 1. NOTIFICATIONS TABLE
-- =============================================
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('booking', 'cancellation', 'rating', 'ride_start', 'ride_complete')),
  ride_id UUID REFERENCES rides(id) ON DELETE SET NULL,
  booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own notifications" ON notifications
  FOR ALL USING (auth.uid() = user_id);

-- =============================================
-- 2. RATINGS TABLE
-- =============================================
CREATE TABLE ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  rated_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  rated_user UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  ride_id UUID NOT NULL REFERENCES rides(id) ON DELETE CASCADE,
  stars INTEGER NOT NULL CHECK (stars BETWEEN 1 AND 5),
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(booking_id, rated_by) -- one rating per booking per person
);

ALTER TABLE ratings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read ratings" ON ratings FOR SELECT USING (TRUE);
CREATE POLICY "Users can rate once per booking" ON ratings FOR INSERT
  WITH CHECK (auth.uid() = rated_by);

-- =============================================
-- 3. LIVE LOCATION TABLE
-- =============================================
CREATE TABLE live_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  ride_id UUID NOT NULL REFERENCES rides(id) ON DELETE CASCADE,
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, ride_id)
);

ALTER TABLE live_locations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Co-riders can see each others location" ON live_locations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM bookings
      WHERE ride_id = live_locations.ride_id
      AND (rider_id = auth.uid())
    )
    OR
    EXISTS (
      SELECT 1 FROM rides
      WHERE id = live_locations.ride_id
      AND driver_id = auth.uid()
    )
  );
CREATE POLICY "Users update own location" ON live_locations
  FOR ALL USING (auth.uid() = user_id);

-- =============================================
-- 4. Add avg_rating to profiles
-- =============================================
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avg_rating DECIMAL(3,2) DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS total_ratings INTEGER DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS total_rides_given INTEGER DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS total_rides_taken INTEGER DEFAULT 0;

-- Auto-update avg_rating when new rating added
CREATE OR REPLACE FUNCTION update_avg_rating()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE profiles SET
    avg_rating = (
      SELECT ROUND(AVG(stars)::numeric, 2) FROM ratings WHERE rated_user = NEW.rated_user
    ),
    total_ratings = (
      SELECT COUNT(*) FROM ratings WHERE rated_user = NEW.rated_user
    )
  WHERE id = NEW.rated_user;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_new_rating
  AFTER INSERT ON ratings
  FOR EACH ROW EXECUTE FUNCTION update_avg_rating();

-- =============================================
-- 5. Function to send notification
-- =============================================
CREATE OR REPLACE FUNCTION notify_user(
  p_user_id UUID,
  p_title TEXT,
  p_message TEXT,
  p_type TEXT,
  p_ride_id UUID DEFAULT NULL,
  p_booking_id UUID DEFAULT NULL
)
RETURNS void AS $$
BEGIN
  INSERT INTO notifications(user_id, title, message, type, ride_id, booking_id)
  VALUES (p_user_id, p_title, p_message, p_type, p_ride_id, p_booking_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Auto-notify car owner when someone books their ride
CREATE OR REPLACE FUNCTION notify_on_booking()
RETURNS TRIGGER AS $$
DECLARE
  v_ride rides%ROWTYPE;
  v_rider profiles%ROWTYPE;
BEGIN
  SELECT * INTO v_ride FROM rides WHERE id = NEW.ride_id;
  SELECT * INTO v_rider FROM profiles WHERE id = NEW.rider_id;

  -- Notify car owner
  PERFORM notify_user(
    v_ride.driver_id,
    '🎉 New Booking!',
    v_rider.full_name || ' booked a seat on your ride (' || v_ride.from_location || ' → ' || v_ride.to_location || ')',
    'booking',
    NEW.ride_id,
    NEW.id
  );

  -- Notify co-rider (confirm)
  PERFORM notify_user(
    NEW.rider_id,
    '✅ Booking Confirmed!',
    'Your seat is confirmed on ' || v_ride.from_location || ' → ' || v_ride.to_location || ' at ' || v_ride.ride_time::text,
    'booking',
    NEW.ride_id,
    NEW.id
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_booking_created
  AFTER INSERT ON bookings
  FOR EACH ROW EXECUTE FUNCTION notify_on_booking();

-- =============================================
-- DONE! 🎉
-- =============================================
