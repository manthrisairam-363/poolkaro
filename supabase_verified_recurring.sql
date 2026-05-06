-- Add verified badge to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE;

-- Add recurring flag to rides
ALTER TABLE rides ADD COLUMN IF NOT EXISTS is_recurring BOOLEAN DEFAULT FALSE;

-- View: show verified users
CREATE OR REPLACE VIEW verified_users AS
SELECT id, full_name, phone, role, avg_rating, is_verified
FROM profiles WHERE is_verified = TRUE;
