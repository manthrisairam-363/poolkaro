-- Work email verification table
CREATE TABLE IF NOT EXISTS work_email_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  work_email TEXT NOT NULL,
  otp TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '10 minutes'),
  verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE work_email_verifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own verifications"
  ON work_email_verifications FOR ALL USING (auth.uid() = user_id);

-- Add work_email and work_email_verified to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS work_email TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS work_email_verified BOOLEAN DEFAULT FALSE;
