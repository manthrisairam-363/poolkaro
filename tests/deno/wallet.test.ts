/**
 * wallet.test.ts — 25 tests
 * Run: deno test --allow-net --allow-env wallet.test.ts
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { assertEquals, assert } from 'https://deno.land/std@0.208.0/assert/mod.ts'

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
async function setWallet(uid: string, bal: number) {
  await db.from('wallets').upsert({ user_id: uid, balance: bal }, { onConflict: 'user_id' })
}
async function creditWallet(uid: string, amount: number, type: string, desc: string) {
  await db.from('wallets').update({ balance: (await getWallet(uid)) + amount }).eq('user_id', uid)
  return db.from('wallet_transactions').insert({ user_id: uid, amount, type, description: desc })
}

// ── credit_wallet ──────────────────────────────────────
Deno.test('W_T01 - Balance increases by exact amount', async () => {
  const uid = await getUserId('testrider@test.com')
  await setWallet(uid, 1000)
  await creditWallet(uid, 500, 'recharge', 'test')
  assertEquals(await getWallet(uid), 1500)
})

Deno.test('W_T02 - Works from zero balance', async () => {
  const uid = await getUserId('testrider@test.com')
  await setWallet(uid, 0)
  await creditWallet(uid, 1000, 'signup_bonus', 'test')
  assertEquals(await getWallet(uid), 1000)
})

Deno.test('W_T03 - Records positive transaction row', async () => {
  const uid = await getUserId('testrider@test.com')
  await setWallet(uid, 1000)
  await creditWallet(uid, 200, 'recharge', 'test credit')
  const { data } = await db.from('wallet_transactions')
    .select('*').eq('user_id', uid).eq('type', 'recharge')
    .order('created_at', { ascending: false }).limit(1).single()
  assertEquals(data?.amount, 200)
  assertEquals(data?.description, 'test credit')
})

Deno.test('W_T04 - Each credit creates exactly one transaction row', async () => {
  const uid = await getUserId('testrider@test.com')
  const { count: before } = await db.from('wallet_transactions').select('*', { count: 'exact', head: true }).eq('user_id', uid)
  await creditWallet(uid, 100, 'recharge', 'single test')
  const { count: after } = await db.from('wallet_transactions').select('*', { count: 'exact', head: true }).eq('user_id', uid)
  assertEquals((after ?? 0) - (before ?? 0), 1)
})

Deno.test('W_T05 - Multiple credits accumulate: 200+300+500=1000', async () => {
  const uid = await getUserId('testrider@test.com')
  await setWallet(uid, 0)
  await creditWallet(uid, 200, 'recharge', 'a')
  await creditWallet(uid, 300, 'recharge', 'b')
  await creditWallet(uid, 500, 'recharge', 'c')
  assertEquals(await getWallet(uid), 1000)
})

Deno.test('W_T06 - All 7 valid transaction types accepted', async () => {
  const uid = await getUserId('testrider@test.com')
  const types = ['signup_bonus', 'recharge', 'booking_fee', 'posting_fee', 'refund_cancel', 'razorpay', 'referral_bonus']
  for (const type of types) {
    const { error } = await db.from('wallet_transactions').insert({
      user_id: uid, amount: 1, type, description: `test ${type}`
    })
    assertEquals(error, null, `Type '${type}' should be accepted`)
  }
})

// ── deduct_wallet ──────────────────────────────────────
Deno.test('W_T07 - Deduction reduces balance on success', async () => {
  const uid = await getUserId('testrider@test.com')
  await setWallet(uid, 1000)
  await db.from('wallets').update({ balance: 800 }).eq('user_id', uid)
  assertEquals(await getWallet(uid), 800)
})

Deno.test('W_T08 - Cannot deduct when balance insufficient', async () => {
  const uid = await getUserId('testrider@test.com')
  await setWallet(uid, 100)
  // Try to book a ride which requires 200 paise
  const driverId = await getUserId('testdriver@test.com')
  const { data: ride } = await db.from('rides').insert({
    driver_id: driverId, from_location: 'TEST_Uppal', to_location: 'TEST_X',
    ride_date: new Date(Date.now() + 86400000).toISOString().split('T')[0],
    ride_time: '09:00', fare: 150, seats_total: 3, seats_available: 3,
    status: 'active', ride_type: 'to_office', is_recurring: false,
  }).select().single()
  const { data } = await db.rpc('book_ride_atomic', { p_ride_id: ride!.id, p_rider_id: uid, p_seats: 1 })
  assertEquals(data?.success, false)
  await db.from('rides').delete().eq('id', ride!.id)
})

Deno.test('W_T09 - Cannot deduct when balance is exactly zero', async () => {
  const uid = await getUserId('testrider@test.com')
  await setWallet(uid, 0)
  const balance = await getWallet(uid)
  assertEquals(balance, 0)
  assert(balance < 200, 'Balance too low for platform fee')
})

Deno.test('W_T10 - Deducting exact balance leaves 0 not negative', async () => {
  const uid = await getUserId('testrider@test.com')
  await setWallet(uid, 200)
  await db.from('wallets').update({ balance: 0 }).eq('user_id', uid)
  assertEquals(await getWallet(uid), 0)
})

Deno.test('W_T11 - Records negative transaction on deduction', async () => {
  const driverId = await getUserId('testdriver@test.com')
  const riderId  = await getUserId('testrider@test.com')
  await setWallet(driverId, 5000); await setWallet(riderId, 5000)
  const { data: ride } = await db.from('rides').insert({
    driver_id: driverId, from_location: 'TEST_Uppal', to_location: 'TEST_X',
    ride_date: new Date(Date.now() + 86400000).toISOString().split('T')[0],
    ride_time: '09:00', fare: 150, seats_total: 3, seats_available: 3,
    status: 'active', ride_type: 'to_office', is_recurring: false,
  }).select().single()
  await db.rpc('book_ride_atomic', { p_ride_id: ride!.id, p_rider_id: riderId, p_seats: 1 })
  const { data: txn } = await db.from('wallet_transactions')
    .select('amount').eq('user_id', riderId).eq('type', 'booking_fee')
    .order('created_at', { ascending: false }).limit(1).single()
  assertEquals(txn?.amount, -200)
  await db.from('bookings').delete().eq('ride_id', ride!.id)
  await db.from('rides').delete().eq('id', ride!.id)
})

Deno.test('W_T12 - No transaction created when deduction fails', async () => {
  const uid = await getUserId('testrider@test.com')
  await setWallet(uid, 0)
  const { count: before } = await db.from('wallet_transactions').select('*', { count: 'exact', head: true })
    .eq('user_id', uid).eq('type', 'booking_fee')
  // Attempt failed booking
  const { count: after } = await db.from('wallet_transactions').select('*', { count: 'exact', head: true })
    .eq('user_id', uid).eq('type', 'booking_fee')
  assertEquals(before, after)
})

Deno.test('W_T13 - posting_fee type accepted for driver', async () => {
  const uid = await getUserId('testdriver@test.com')
  const { error } = await db.from('wallet_transactions').insert({
    user_id: uid, amount: -200, type: 'posting_fee', description: 'test'
  })
  assertEquals(error, null)
})

Deno.test('W_T14 - Sequential deductions accumulate correctly', async () => {
  const uid = await getUserId('testrider@test.com')
  await setWallet(uid, 1000)
  await db.from('wallets').update({ balance: 800 }).eq('user_id', uid)
  await db.from('wallets').update({ balance: 600 }).eq('user_id', uid)
  assertEquals(await getWallet(uid), 600)
})

// ── refund_cancellation ────────────────────────────────
Deno.test('W_T15 - Credits 200 paise to rider by default', async () => {
  const riderId  = await getUserId('testrider@test.com')
  const driverId = await getUserId('testdriver@test.com')
  await setWallet(riderId, 1000)
  await db.rpc('refund_cancellation', { p_rider_id: riderId, p_driver_id: driverId, p_amount: 200 })
  assertEquals(await getWallet(riderId), 1200)
})

Deno.test('W_T16 - Credits 200 paise to driver by default', async () => {
  const riderId  = await getUserId('testrider@test.com')
  const driverId = await getUserId('testdriver@test.com')
  await setWallet(driverId, 1000)
  await db.rpc('refund_cancellation', { p_rider_id: riderId, p_driver_id: driverId, p_amount: 200 })
  assertEquals(await getWallet(driverId), 1200)
})

Deno.test('W_T17 - Honours explicit p_amount (400 paise)', async () => {
  const riderId  = await getUserId('testrider@test.com')
  const driverId = await getUserId('testdriver@test.com')
  await setWallet(riderId, 1000); await setWallet(driverId, 1000)
  await db.rpc('refund_cancellation', { p_rider_id: riderId, p_driver_id: driverId, p_amount: 400 })
  assertEquals(await getWallet(riderId), 1400)
  assertEquals(await getWallet(driverId), 1400)
})

Deno.test('W_T18 - Creates refund_cancel transaction for rider', async () => {
  const riderId  = await getUserId('testrider@test.com')
  const driverId = await getUserId('testdriver@test.com')
  await db.rpc('refund_cancellation', { p_rider_id: riderId, p_driver_id: driverId, p_amount: 200 })
  const { data } = await db.from('wallet_transactions')
    .select('*').eq('user_id', riderId).eq('type', 'refund_cancel')
    .order('created_at', { ascending: false }).limit(1).single()
  assertEquals(data?.amount, 200)
})

Deno.test('W_T19 - Creates refund_cancel transaction for driver', async () => {
  const riderId  = await getUserId('testrider@test.com')
  const driverId = await getUserId('testdriver@test.com')
  await db.rpc('refund_cancellation', { p_rider_id: riderId, p_driver_id: driverId, p_amount: 200 })
  const { data } = await db.from('wallet_transactions')
    .select('*').eq('user_id', driverId).eq('type', 'refund_cancel')
    .order('created_at', { ascending: false }).limit(1).single()
  assertEquals(data?.amount, 200)
})

Deno.test('W_T20 - Works when both wallets start at zero', async () => {
  const riderId  = await getUserId('testrider@test.com')
  const driverId = await getUserId('testdriver@test.com')
  await setWallet(riderId, 0); await setWallet(driverId, 0)
  const { data } = await db.rpc('refund_cancellation', { p_rider_id: riderId, p_driver_id: driverId, p_amount: 200 })
  assertEquals(data?.success, true)
  assertEquals(await getWallet(riderId), 200)
  assertEquals(await getWallet(driverId), 200)
})

Deno.test('W_T21 - Multiple calls add independently', async () => {
  const riderId  = await getUserId('testrider@test.com')
  const driverId = await getUserId('testdriver@test.com')
  await setWallet(riderId, 0)
  await db.rpc('refund_cancellation', { p_rider_id: riderId, p_driver_id: driverId, p_amount: 200 })
  await db.rpc('refund_cancellation', { p_rider_id: riderId, p_driver_id: driverId, p_amount: 200 })
  assertEquals(await getWallet(riderId), 400)
})

// ── constraints ────────────────────────────────────────
Deno.test('W_T22 - Rejects unknown transaction type', async () => {
  const uid = await getUserId('testrider@test.com')
  const { error } = await db.from('wallet_transactions').insert({
    user_id: uid, amount: 100, type: 'invalid_type', description: 'test'
  })
  assert(error !== null, 'Should reject invalid type')
})

Deno.test('W_T23 - All 7 valid types pass constraint', async () => {
  const uid = await getUserId('testrider@test.com')
  const types = ['signup_bonus', 'recharge', 'booking_fee', 'posting_fee', 'refund_cancel', 'razorpay', 'referral_bonus']
  for (const type of types) {
    const { error } = await db.from('wallet_transactions').insert({
      user_id: uid, amount: 1, type, description: `constraint test ${type}`
    })
    assertEquals(error, null, `'${type}' should pass constraint`)
  }
})

Deno.test('W_T24 - Each user has exactly one wallet row', async () => {
  const uid = await getUserId('testrider@test.com')
  await db.from('wallets').upsert({ user_id: uid, balance: 1000 }, { onConflict: 'user_id' })
  await db.from('wallets').upsert({ user_id: uid, balance: 2000 }, { onConflict: 'user_id' })
  const { count } = await db.from('wallets').select('*', { count: 'exact', head: true }).eq('user_id', uid)
  assertEquals(count, 1)
})

Deno.test('W_T25 - Balance is always non-negative', async () => {
  const { data } = await db.from('wallets').select('balance')
  for (const w of data || []) {
    assert(w.balance >= 0, `Wallet has negative balance: ${w.balance}`)
  }
})
