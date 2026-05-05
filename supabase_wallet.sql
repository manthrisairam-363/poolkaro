-- =============================================
-- POOLKARO WALLET SYSTEM
-- =============================================

-- 1. WALLETS TABLE
CREATE TABLE wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  balance INTEGER NOT NULL DEFAULT 0, -- stored in paise (₹1 = 100)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own wallet" ON wallets FOR ALL USING (auth.uid() = user_id);

-- 2. WALLET TRANSACTIONS TABLE
CREATE TABLE wallet_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL, -- positive = credit, negative = debit (in paise)
  type TEXT NOT NULL CHECK (type IN (
    'signup_bonus',   -- free ₹10 on signup
    'recharge',       -- user topped up
    'booking_fee',    -- ₹2 deducted when booking
    'posting_fee',    -- ₹2 deducted when booking confirmed (car owner)
    'refund_cancel',  -- ₹2 refunded on cancellation
    'razorpay'        -- payment gateway recharge
  )),
  description TEXT,
  ride_id UUID REFERENCES rides(id) ON DELETE SET NULL,
  booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
  razorpay_payment_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE wallet_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own transactions" ON wallet_transactions
  FOR ALL USING (auth.uid() = user_id);

-- 3. FUNCTION: Create wallet + give ₹10 signup bonus
CREATE OR REPLACE FUNCTION create_wallet_for_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Create wallet with ₹10 free (1000 paise)
  INSERT INTO wallets (user_id, balance)
  VALUES (NEW.id, 1000)
  ON CONFLICT (user_id) DO NOTHING;

  -- Record signup bonus transaction
  INSERT INTO wallet_transactions (user_id, amount, type, description)
  VALUES (NEW.id, 1000, 'signup_bonus', 'Welcome bonus - ₹10 free credits!');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger: when onboarding completes
CREATE TRIGGER on_onboarding_complete
  AFTER UPDATE ON profiles
  FOR EACH ROW
  WHEN (NEW.onboarding_complete = TRUE AND OLD.onboarding_complete = FALSE)
  EXECUTE FUNCTION create_wallet_for_new_user();

-- 4. FUNCTION: Deduct wallet balance safely
CREATE OR REPLACE FUNCTION deduct_wallet(
  p_user_id UUID,
  p_amount INTEGER,  -- in paise
  p_type TEXT,
  p_description TEXT,
  p_booking_id UUID DEFAULT NULL,
  p_ride_id UUID DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  v_balance INTEGER;
BEGIN
  -- Lock the wallet row
  SELECT balance INTO v_balance
  FROM wallets WHERE user_id = p_user_id FOR UPDATE;

  -- Check sufficient balance
  IF v_balance < p_amount THEN
    RETURN FALSE;
  END IF;

  -- Deduct balance
  UPDATE wallets
  SET balance = balance - p_amount, updated_at = NOW()
  WHERE user_id = p_user_id;

  -- Record transaction
  INSERT INTO wallet_transactions (user_id, amount, type, description, booking_id, ride_id)
  VALUES (p_user_id, -p_amount, p_type, p_description, p_booking_id, p_ride_id);

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. FUNCTION: Credit wallet
CREATE OR REPLACE FUNCTION credit_wallet(
  p_user_id UUID,
  p_amount INTEGER,
  p_type TEXT,
  p_description TEXT,
  p_booking_id UUID DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  UPDATE wallets
  SET balance = balance + p_amount, updated_at = NOW()
  WHERE user_id = p_user_id;

  INSERT INTO wallet_transactions (user_id, amount, type, description, booking_id)
  VALUES (p_user_id, p_amount, p_type, p_description, p_booking_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. AUTO DEDUCT on booking confirmed (both rider and car owner)
CREATE OR REPLACE FUNCTION wallet_deduct_on_booking()
RETURNS TRIGGER AS $$
DECLARE
  v_ride rides%ROWTYPE;
  v_rider_ok BOOLEAN;
  v_owner_ok BOOLEAN;
BEGIN
  SELECT * INTO v_ride FROM rides WHERE id = NEW.ride_id;

  -- Deduct ₹2 (200 paise) from co-rider
  SELECT deduct_wallet(
    NEW.rider_id, 200, 'booking_fee',
    'Platform fee for booking ' || v_ride.from_location || ' → ' || v_ride.to_location,
    NEW.id, NEW.ride_id
  ) INTO v_rider_ok;

  -- Deduct ₹2 (200 paise) from car owner
  SELECT deduct_wallet(
    v_ride.driver_id, 200, 'posting_fee',
    'Platform fee for confirmed booking on your ride',
    NEW.id, NEW.ride_id
  ) INTO v_owner_ok;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_booking_wallet_deduct
  AFTER INSERT ON bookings
  FOR EACH ROW
  WHEN (NEW.payment_status = 'paid' AND NEW.status = 'confirmed')
  EXECUTE FUNCTION wallet_deduct_on_booking();

-- 7. AUTO REFUND on cancellation
CREATE OR REPLACE FUNCTION wallet_refund_on_cancel()
RETURNS TRIGGER AS $$
DECLARE
  v_ride rides%ROWTYPE;
BEGIN
  -- Only refund if status changed to cancelled
  IF NEW.status = 'cancelled' AND OLD.status != 'cancelled' THEN
    SELECT * INTO v_ride FROM rides WHERE id = NEW.ride_id;

    -- Refund co-rider
    PERFORM credit_wallet(
      NEW.rider_id, 200, 'refund_cancel',
      'Refund for cancelled booking', NEW.id
    );

    -- Refund car owner
    PERFORM credit_wallet(
      v_ride.driver_id, 200, 'refund_cancel',
      'Refund for cancelled booking on your ride', NEW.id
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_booking_cancelled_refund
  AFTER UPDATE ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION wallet_refund_on_cancel();

-- 8. Give existing users ₹10 bonus (run once)
INSERT INTO wallets (user_id, balance)
SELECT id, 1000 FROM profiles
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO wallet_transactions (user_id, amount, type, description)
SELECT id, 1000, 'signup_bonus', 'Welcome bonus - ₹10 free credits!'
FROM profiles
WHERE id NOT IN (SELECT user_id FROM wallet_transactions WHERE type = 'signup_bonus');

-- =============================================
-- DONE! Wallet system ready 🎉
-- =============================================
