/**
 * referral.test.ts — 10 tests
 * Uses testdriver as referrer, testrider as new user
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { assertEquals, assertExists } from 'https://deno.land/std@0.208.0/assert/mod.ts'

const URL = Deno.env.get('SUPABASE_URL')!
const KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const db  = createClient(URL, KEY, { auth: { autoRefreshToken: false, persistSession: false } })

const DRIVER_EMAIL = 'testdriver@test.com'
const RIDER_EMAIL  = 'testrider@test.com'

async function getId(email: string) {
  const { data } = await db.from('profiles').select('id').eq('email', email).maybeSingle()
  return data!.id as string
}
async function getWallet(uid: string) {
  const { data } = await db.from('wallets').select('balance').eq('user_id', uid).maybeSingle()
  return data?.balance ?? 0
}
async function getCount(uid: string) {
  const { data } = await db.from('profiles').select('referral_count').eq('id', uid).maybeSingle()
  return data?.referral_count ?? 0
}
async function setup() {
  const driverId = await getId(DRIVER_EMAIL)
  const riderId  = await getId(RIDER_EMAIL)
  // Set known wallets
  await db.from('wallets').update({ balance: 5000 }).eq('user_id', driverId)
  await db.from('wallets').update({ balance: 5000 }).eq('user_id', riderId)
  // Set known referral code + count, clear phone from rider
  const code = 'TESTCD'
  await db.from('profiles').update({ referral_code: code, referral_count: 0 }).eq('id', driverId)
  await db.from('profiles').update({ phone: null }).eq('id', riderId)
  return { driverId, riderId, code }
}

Deno.test('R_T01 - gives new user ₹10', async () => {
  const { driverId, riderId, code } = await setup()
  await db.from('wallet_transactions').delete().eq('user_id', riderId).eq('type', 'referral_bonus')
  const { data } = await db.rpc('complete_onboarding_referral', {
    p_new_user_id: riderId, p_referral_code: code, p_new_user_name: 'Rider'
  })
  if (!data?.success) throw new Error('Failed: ' + JSON.stringify(data))
  assertEquals(await getWallet(riderId), 6000)
})

Deno.test('R_T02 - gives referrer ₹10', async () => {
  const { driverId, riderId, code } = await setup()
  const { data } = await db.rpc('complete_onboarding_referral', {
    p_new_user_id: riderId, p_referral_code: code, p_new_user_name: 'Rider'
  })
  if (!data?.success) throw new Error('Failed: ' + JSON.stringify(data))
  assertEquals(await getWallet(driverId), 6000)
})

Deno.test('R_T03 - referral_count incremented', async () => {
  const { driverId, riderId, code } = await setup()
  await db.rpc('complete_onboarding_referral', {
    p_new_user_id: riderId, p_referral_code: code, p_new_user_name: 'Rider'
  })
  assertEquals(await getCount(driverId), 1)
})

Deno.test('R_T04 - referral bonus transaction for new user', async () => {
  const { driverId, riderId, code } = await setup()
  await db.from('wallet_transactions').delete().eq('user_id', riderId).eq('type', 'referral_bonus')
  await db.rpc('complete_onboarding_referral', {
    p_new_user_id: riderId, p_referral_code: code, p_new_user_name: 'Rider'
  })
  const { data: txn } = await db.from('wallet_transactions')
    .select('amount').eq('user_id', riderId).eq('type', 'referral_bonus')
    .order('created_at', { ascending: false }).limit(1).single()
  assertEquals(txn?.amount, 1000)
})

Deno.test('R_T05 - referral bonus transaction for referrer', async () => {
  const { driverId, riderId, code } = await setup()
  await db.rpc('complete_onboarding_referral', {
    p_new_user_id: riderId, p_referral_code: code, p_new_user_name: 'Rider'
  })
  const { data: txn } = await db.from('wallet_transactions')
    .select('amount').eq('user_id', driverId).eq('type', 'referral_bonus')
    .order('created_at', { ascending: false }).limit(1).single()
  assertEquals(txn?.amount, 1000)
})

Deno.test('R_T06 - notification sent to referrer', async () => {
  const { driverId, riderId, code } = await setup()
  await db.from('notifications').delete().eq('user_id', driverId).eq('title', '🎁 Referral Bonus!')
  await db.rpc('complete_onboarding_referral', {
    p_new_user_id: riderId, p_referral_code: code, p_new_user_name: 'Rider'
  })
  const { data: notif } = await db.from('notifications')
    .select('title').eq('user_id', driverId).eq('title', '🎁 Referral Bonus!').single()
  assertExists(notif)
})

Deno.test('R_T07 - fails for invalid referral code', async () => {
  const { riderId } = await setup()
  const { data } = await db.rpc('complete_onboarding_referral', {
    p_new_user_id: riderId, p_referral_code: 'INVALID', p_new_user_name: 'Rider'
  })
  assertEquals(data?.success, false)
})

Deno.test('R_T08 - duplicate phone blocked', async () => {
  const { driverId, riderId, code } = await setup()
  // Set same phone on another profile
  await db.from('profiles').update({ phone: '9000000099' }).eq('id', riderId)
  await db.from('profiles').update({ phone: '9000000099' }).eq('id', driverId)
  const before = await getCount(driverId)
  await db.rpc('complete_onboarding_referral', {
    p_new_user_id: riderId, p_referral_code: code, p_new_user_name: 'Rider'
  })
  assertEquals(await getCount(driverId), before)
  // Reset phones
  await db.from('profiles').update({ phone: null }).eq('id', riderId)
  await db.from('profiles').update({ phone: null }).eq('id', driverId)
})

Deno.test('R_T09 - cannot refer yourself', async () => {
  const { driverId, code } = await setup()
  const before = await getWallet(driverId)
  const { data } = await db.rpc('complete_onboarding_referral', {
    p_new_user_id: driverId, p_referral_code: code, p_new_user_name: 'Self'
  })
  assertEquals(data?.success, false)
  assertEquals(await getWallet(driverId), before)
})

Deno.test('R_T10 - referral code is case insensitive', async () => {
  const { driverId, riderId, code } = await setup()
  const { data } = await db.rpc('complete_onboarding_referral', {
    p_new_user_id: riderId, p_referral_code: code.toLowerCase(), p_new_user_name: 'Rider'
  })
  assertEquals(data?.success, true)
})
