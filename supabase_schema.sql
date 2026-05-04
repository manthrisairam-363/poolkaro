-- PoolKaro Database Schema
-- Run this entire file in Supabase → SQL Editor → New Query → Run

-- =============================================
-- 1. PROFILES TABLE (one per user)
-- =============================================
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT '',
  phone TEXT,
  email TEXT,
  role TEXT CHECK (role IN ('rider', 'driver', 'both')) DEFAULT 'both',
  vehicle_model TEXT,
  vehicle_number TEXT,
  upi_id TEXT,
  avatar_url TEXT,
  onboarding_complete BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-create empty profile when user signs up
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, phone, email)
  VALUES (
    NEW.id,
    NEW.phone,
    NEW.email
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- =============================================
-- 2. RIDES TABLE
-- =============================================
CREATE TABLE rides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  ride_type TEXT NOT NULL CHECK (ride_type IN ('to_office', 'to_home')),
  ride_date DATE NOT NULL,
  ride_time TIME NOT NULL,
  from_location TEXT NOT NULL,
  to_location TEXT NOT NULL,
  route_description TEXT,
  fare INTEGER NOT NULL CHECK (fare > 0),
  seats_total INTEGER NOT NULL DEFAULT 2,
  seats_available INTEGER NOT NULL DEFAULT 2,
  vehicle_model TEXT,
  vehicle_number TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'full', 'cancelled', 'completed')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 3. BOOKINGS TABLE
-- =============================================
CREATE TABLE bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ride_id UUID NOT NULL REFERENCES rides(id) ON DELETE CASCADE,
  rider_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  seats_booked INTEGER NOT NULL DEFAULT 1,
  ride_fare INTEGER NOT NULL,       -- e.g. 150
  platform_fee INTEGER NOT NULL DEFAULT 2,  -- PoolKaro fee from rider
  driver_deduction INTEGER NOT NULL DEFAULT 2, -- PoolKaro fee from driver
  total_paid INTEGER NOT NULL,      -- ride_fare + platform_fee = 152
  driver_receives INTEGER NOT NULL, -- ride_fare - driver_deduction = 148
  payment_id TEXT,                  -- Razorpay payment ID
  payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'failed', 'refunded')),
  status TEXT DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'cancelled', 'completed')),
  cancelled_at TIMESTAMPTZ,
  cancellation_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 4. ROW LEVEL SECURITY (RLS)
-- Protects data — users can only see what they should
-- =============================================

-- Profiles: everyone can read, only owner can write
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public profiles are viewable" ON profiles FOR SELECT USING (TRUE);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Rides: everyone can read active rides, only driver can manage own rides
ALTER TABLE rides ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Active rides are public" ON rides FOR SELECT USING (TRUE);
CREATE POLICY "Drivers can insert rides" ON rides FOR INSERT WITH CHECK (auth.uid() = driver_id);
CREATE POLICY "Drivers can update own rides" ON rides FOR UPDATE USING (auth.uid() = driver_id);

-- Bookings: rider and driver can see their own bookings
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Riders see own bookings" ON bookings FOR SELECT USING (auth.uid() = rider_id);
CREATE POLICY "Drivers see bookings for their rides" ON bookings FOR SELECT
  USING (EXISTS (SELECT 1 FROM rides WHERE rides.id = bookings.ride_id AND rides.driver_id = auth.uid()));
CREATE POLICY "Riders can create bookings" ON bookings FOR INSERT WITH CHECK (auth.uid() = rider_id);

-- =============================================
-- 5. FUNCTION: Reduce seats when booking confirmed
-- =============================================
CREATE OR REPLACE FUNCTION confirm_booking()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE rides
  SET seats_available = seats_available - NEW.seats_booked,
      status = CASE WHEN seats_available - NEW.seats_booked <= 0 THEN 'full' ELSE 'active' END
  WHERE id = NEW.ride_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_booking_confirmed
  AFTER INSERT ON bookings
  FOR EACH ROW
  WHEN (NEW.payment_status = 'paid')
  EXECUTE FUNCTION confirm_booking();

-- =============================================
-- DONE! Your database is ready 🎉
-- =============================================
