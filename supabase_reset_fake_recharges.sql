-- Reset all fake recharges (keep only signup bonus of ₹10)
-- Run this in Supabase SQL Editor immediately

-- 1. Delete all fake recharge transactions
DELETE FROM wallet_transactions 
WHERE type = 'recharge';

-- 2. Reset all wallet balances to only signup bonus (₹10 = 1000 paise)
-- minus any legitimate deductions (booking fees etc)
UPDATE wallets w
SET balance = (
  SELECT COALESCE(SUM(amount), 0)
  FROM wallet_transactions wt
  WHERE wt.user_id = w.user_id
  AND wt.type != 'recharge'  -- exclude fake recharges
)
WHERE user_id IN (SELECT user_id FROM wallets);

-- 3. Verify - show all wallet balances
SELECT 
  p.full_name,
  w.balance,
  w.balance / 100.0 as balance_rupees
FROM wallets w
JOIN profiles p ON p.id = w.user_id
ORDER BY w.balance DESC;
