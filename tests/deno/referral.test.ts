/**
 * referral.test.ts — 10 tests
 * Run: deno test --allow-net --allow-env tests/deno/referral.test.ts
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { assertEquals, assertExists, assert } from 'https://deno.land/std@0.208.0/assert/mod.ts'

const URL = Deno.env.get('SUPABASE_URL')!
const KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const db  = createClient(URL, KEY, { auth: { autoRefreshToken: false, persistSession: false } })

async function getUserId(email: string) {
  const { data } = await db.from('profiles').select('id').eq('email', email).maybeSingle()
  return data!.id as string
}
async function getWallet(uid: string) {
  const { data } = await db.from('wallets').select('balance').eq('user_id', uid).maybeSingle()
  return data?.balance ?? 0
}
async function getReferralCode(uid: string) {
  const { data } = await db.from('profiles').select('referral_code').eq('id', uid).maybeSingle()
  return data?.referral_code as string
}
async function getReferralCount(uid: string) {
  const { data } = await db.from('profiles').select('referral_count').eq('id', uid).maybeSingle()
  return data?.referral_count ?? 0
}
async function cleanup(newUserId: string) {
  await db.from('wallet_transactions').delete().eq('user_id', newUserId)
  await db.from('wallets').delete().eq('user_id', newUserId)
  await db.from('notifications').delete().eq('user_id', newUserId)
  await db.from('profiles').delete().eq('id', newUserId)
  await db.auth.admin.deleteUser(newUserId)
}
async function createTestUser(suffix: string) {
  const email = `test_referral_${suffix}_${Date.now()}@phone.carpoolkaro.com`
  const { data } = await db.auth.admin.createUser({ email, email_confirm: true })
  const uid = data.user!.id
  // Create profile and wallet
  await db.from('profiles').insert({
    id: uid, full_name: `Test User ${suffix}`, email,
    role: 'both', onboarding_complete: false,
    referral_code: Math.random().toString(36).slice(2,8).toUpperCase(),
  })
  await db.from('wallets').insert({ user_id: uid, balance: 0 })
  return uid
}

// ── Tests ──────────────────────────────────────────────
Deno.test('R_T01 - complete_onboarding_referral gives new user ₹10', async () => {
  const referrerId = await getUserId('testdriver@test.com')
  const refCode = await getReferralCode(referrerId)
  const newUserId = await createTestUser('r01')
  try {
    await db.rpc('complete_onboarding_referral', {
      p_new_user_id: newUserId,
      p_referral_code: refCode,
      p_new_user_name: 'Test R01',
    })
    assertEquals(await getWallet(newUserId), 1000)
  } finally { await cleanup(newUserId) }
})

Deno.test('R_T02 - complete_onboarding_referral gives referrer ₹10', async () => {
  const referrerId = await getUserId('testdriver@test.com')
  const refCode = await getReferralCode(referrerId)
  const before = await getWallet(referrerId)
  const newUserId = await createTestUser('r02')
  try {
    await db.rpc('complete_onboarding_referral', {
      p_new_user_id: newUserId,
      p_referral_code: refCode,
      p_new_user_name: 'Test R02',
    })
    assertEquals(await getWallet(referrerId), before + 1000)
  } finally { await cleanup(newUserId) }
})

Deno.test('R_T03 - referral_count incremented on referrer profile', async () => {
  const referrerId = await getUserId('testdriver@test.com')
  const refCode = await getReferralCode(referrerId)
  const before = await getReferralCount(referrerId)
  const newUserId = await createTestUser('r03')
  try {
    await db.rpc('complete_onboarding_referral', {
      p_new_user_id: newUserId,
      p_referral_code: refCode,
      p_new_user_name: 'Test R03',
    })
    assertEquals(await getReferralCount(referrerId), before + 1)
  } finally { await cleanup(newUserId) }
})

Deno.test('R_T04 - referral bonus transaction created for new user', async () => {
  const referrerId = await getUserId('testdriver@test.com')
  const refCode = await getReferralCode(referrerId)
  const newUserId = await createTestUser('r04')
  try {
    await db.rpc('complete_onboarding_referral', {
      p_new_user_id: newUserId,
      p_referral_code: refCode,
      p_new_user_name: 'Test R04',
    })
    const { data: txn } = await db.from('wallet_transactions')
      .select('amount, type').eq('user_id', newUserId).eq('type', 'referral_bonus').single()
    assertEquals(txn?.amount, 1000)
  } finally { await cleanup(newUserId) }
})

Deno.test('R_T05 - referral bonus transaction created for referrer', async () => {
  const referrerId = await getUserId('testdriver@test.com')
  const refCode = await getReferralCode(referrerId)
  const newUserId = await createTestUser('r05')
  try {
    await db.rpc('complete_onboarding_referral', {
      p_new_user_id: newUserId,
      p_referral_code: refCode,
      p_new_user_name: 'Test R05',
    })
    const { data: txn } = await db.from('wallet_transactions')
      .select('amount').eq('user_id', referrerId).eq('type', 'referral_bonus')
      .order('created_at', { ascending: false }).limit(1).single()
    assertEquals(txn?.amount, 1000)
  } finally { await cleanup(newUserId) }
})

Deno.test('R_T06 - notification sent to referrer', async () => {
  const referrerId = await getUserId('testdriver@test.com')
  const refCode = await getReferralCode(referrerId)
  const newUserId = await createTestUser('r06')
  try {
    await db.rpc('complete_onboarding_referral', {
      p_new_user_id: newUserId,
      p_referral_code: refCode,
      p_new_user_name: 'Test R06',
    })
    const { data: notif } = await db.from('notifications')
      .select('title').eq('user_id', referrerId).eq('title', '🎁 Referral Bonus!')
      .order('created_at', { ascending: false }).limit(1).single()
    assertExists(notif)
  } finally { await cleanup(newUserId) }
})

Deno.test('R_T07 - fails for invalid referral code', async () => {
  const newUserId = await createTestUser('r07')
  try {
    const { data } = await db.rpc('complete_onboarding_referral', {
      p_new_user_id: newUserId,
      p_referral_code: 'INVALID',
      p_new_user_name: 'Test R07',
    })
    assertEquals(data?.success, false)
  } finally { await cleanup(newUserId) }
})

Deno.test('R_T08 - duplicate phone blocked: no bonus for referrer', async () => {
  const referrerId = await getUserId('testdriver@test.com')
  const refCode = await getReferralCode(referrerId)
  // Create user with existing phone
  const uid1 = await createTestUser('r08a')
  await db.from('profiles').update({ phone: '9000000001' }).eq('id', uid1)
  const uid2 = await createTestUser('r08b')
  await db.from('profiles').update({ phone: '9000000001' }).eq('id', uid2)
  const beforeCount = await getReferralCount(referrerId)
  try {
    await db.rpc('complete_onboarding_referral', {
      p_new_user_id: uid2,
      p_referral_code: refCode,
      p_new_user_name: 'Duplicate',
    })
    assertEquals(await getReferralCount(referrerId), beforeCount)
  } finally {
    await cleanup(uid1)
    await cleanup(uid2)
  }
})

Deno.test('R_T09 - cannot refer yourself', async () => {
  const referrerId = await getUserId('testdriver@test.com')
  const refCode = await getReferralCode(referrerId)
  const before = await getWallet(referrerId)
  const { data } = await db.rpc('complete_onboarding_referral', {
    p_new_user_id: referrerId,
    p_referral_code: refCode,
    p_new_user_name: 'Self',
  })
  assertEquals(data?.success, false)
  assertEquals(await getWallet(referrerId), before)
})

Deno.test('R_T10 - referral code is case insensitive', async () => {
  const referrerId = await getUserId('testdriver@test.com')
  const refCode = await getReferralCode(referrerId)
  const newUserId = await createTestUser('r10')
  try {
    const { data } = await db.rpc('complete_onboarding_referral', {
      p_new_user_id: newUserId,
      p_referral_code: refCode.toLowerCase(),
      p_new_user_name: 'Test R10',
    })
    assertEquals(data?.success, true)
  } finally { await cleanup(newUserId) }
})
