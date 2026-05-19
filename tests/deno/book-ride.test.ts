/**
 * book-ride.test.ts — 18 tests
 * Run: deno test --allow-net --allow-env book-ride.test.ts
 * Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { assertEquals, assertExists, assert } from 'https://deno.land/std@0.208.0/assert/mod.ts'

const URL  = Deno.env.get('SUPABASE_URL')!
const KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const db   = createClient(URL, KEY, { auth: { autoRefreshToken: false, persistSession: false } })

// ── helpers ──────────────────────────────────────────────
async function getUserId(email: string): Promise<string> {
  const { data } = await db.from('profiles').select('id').eq('email', email).maybeSingle()
  if (!data) throw new Error(`User not found: ${email}`)
  return data.id
}

async function getWallet(userId: string): Promise<number> {
  const { data } = await db.from('wallets').select('balance').eq('user_id', userId).maybeSingle()
  return data?.balance ?? 0
}

async function setWallet(userId: string, balance: number) {
  await db.from('wallets').upsert({ user_id: userId, balance }, { onConflict: 'user_id' })
}

async function createTestRide(driverId: string, fare = 150, seats = 3) {
  const { data } = await db.from('rides').insert({
    driver_id: driverId,
    from_location: 'TEST_Uppal',
    to_location: 'TEST_Kokapet',
    ride_date: new Date(Date.now() + 86400000).toISOString().split('T')[0],
    ride_time: '09:00',
    fare,
    seats_total: seats,
    seats_available: seats,
    status: 'active',
    ride_type: 'to_office',
    is_recurring: false,
  }).select().single()
  return data!
}

async function cleanup(rideId?: string) {
  if (rideId) {
    await db.from('bookings').delete().eq('ride_id', rideId)
    await db.from('rides').delete().eq('id', rideId)
  }
  await db.from('rides').delete().eq('from_location', 'TEST_Uppal').eq('to_location', 'TEST_Kokapet')
}

async function book(rideId: string, riderId: string, seats = 1) {
  return db.rpc('book_ride_atomic', { p_ride_id: rideId, p_rider_id: riderId, p_seats: seats })
}

// ── tests ────────────────────────────────────────────────
Deno.test('setup', async () => {
  const driverId = await getUserId('testdriver@test.com')
  const riderId  = await getUserId('testrider@test.com')
  await setWallet(driverId, 5000)
  await setWallet(riderId, 5000)
  await cleanup()
  assertExists(driverId)
  assertExists(riderId)
})

Deno.test('T01 - Returns success: true', async () => {
  const driverId = await getUserId('testdriver@test.com')
  const riderId  = await getUserId('testrider@test.com')
  const ride = await createTestRide(driverId)
  const { data } = await book(ride.id, riderId)
  assertEquals(data?.success, true)
  await cleanup(ride.id)
})

Deno.test('T02 - Booking has status: confirmed and payment_status: paid', async () => {
  const driverId = await getUserId('testdriver@test.com')
  const riderId  = await getUserId('testrider@test.com')
  const ride = await createTestRide(driverId)
  const { data } = await book(ride.id, riderId)
  assertEquals(data?.booking?.status, 'confirmed')
  assertEquals(data?.booking?.payment_status, 'paid')
  await cleanup(ride.id)
})

Deno.test('T03 - Decrements seats_available by seats booked', async () => {
  const driverId = await getUserId('testdriver@test.com')
  const riderId  = await getUserId('testrider@test.com')
  const ride = await createTestRide(driverId, 150, 3)
  await book(ride.id, riderId, 1)
  const { data: updated } = await db.from('rides').select('seats_available').eq('id', ride.id).single()
  assertEquals(updated?.seats_available, 2)
  await cleanup(ride.id)
})

Deno.test('T04 - Marks ride as full when last seat taken', async () => {
  const driverId = await getUserId('testdriver@test.com')
  const riderId  = await getUserId('testrider@test.com')
  const ride = await createTestRide(driverId, 150, 1)
  await book(ride.id, riderId, 1)
  const { data: updated } = await db.from('rides').select('status, seats_available').eq('id', ride.id).single()
  assertEquals(updated?.status, 'full')
  assertEquals(updated?.seats_available, 0)
  await cleanup(ride.id)
})

Deno.test('T05 - Ride stays active when seats remain', async () => {
  const driverId = await getUserId('testdriver@test.com')
  const riderId  = await getUserId('testrider@test.com')
  const ride = await createTestRide(driverId, 150, 3)
  await book(ride.id, riderId, 1)
  const { data: updated } = await db.from('rides').select('status').eq('id', ride.id).single()
  assertEquals(updated?.status, 'active')
  await cleanup(ride.id)
})

Deno.test('T06 - fare=150, 1 seat → total_paid=152, driver_receives=148, platform_fee=2', async () => {
  const driverId = await getUserId('testdriver@test.com')
  const riderId  = await getUserId('testrider@test.com')
  const ride = await createTestRide(driverId, 150, 3)
  const { data } = await book(ride.id, riderId, 1)
  assertEquals(data?.booking?.total_paid, 152)
  assertEquals(data?.booking?.driver_receives, 148)
  assertEquals(data?.booking?.platform_fee, 2)
  await cleanup(ride.id)
})

Deno.test('T07 - fare=100, 2 seats → total_paid=204, driver_receives=196, seats_booked=2', async () => {
  const driverId = await getUserId('testdriver@test.com')
  const riderId  = await getUserId('testrider@test.com')
  const ride = await createTestRide(driverId, 100, 3)
  const { data } = await book(ride.id, riderId, 2)
  assertEquals(data?.booking?.total_paid, 204)
  assertEquals(data?.booking?.driver_receives, 196)
  assertEquals(data?.booking?.seats_booked, 2)
  await cleanup(ride.id)
})

Deno.test('T08 - Rider wallet deducted 200 paise per seat', async () => {
  const driverId = await getUserId('testdriver@test.com')
  const riderId  = await getUserId('testrider@test.com')
  await setWallet(riderId, 5000)
  const ride = await createTestRide(driverId)
  await book(ride.id, riderId, 1)
  const balance = await getWallet(riderId)
  assertEquals(balance, 4800)
  await cleanup(ride.id)
})

Deno.test('T09 - Driver wallet deducted 200 paise per seat', async () => {
  const driverId = await getUserId('testdriver@test.com')
  const riderId  = await getUserId('testrider@test.com')
  await setWallet(driverId, 5000)
  const ride = await createTestRide(driverId)
  await book(ride.id, riderId, 1)
  const balance = await getWallet(driverId)
  assertEquals(balance, 4800)
  await cleanup(ride.id)
})

Deno.test('T10 - booking_fee transaction created for rider with amount -200', async () => {
  const driverId = await getUserId('testdriver@test.com')
  const riderId  = await getUserId('testrider@test.com')
  const ride = await createTestRide(driverId)
  const { data: booking } = await book(ride.id, riderId, 1)
  const { data: txn } = await db.from('wallet_transactions')
    .select('*').eq('user_id', riderId).eq('type', 'booking_fee')
    .order('created_at', { ascending: false }).limit(1).single()
  assertEquals(txn?.amount, -200)
  assertEquals(txn?.type, 'booking_fee')
  await cleanup(ride.id)
})

Deno.test('T11 - posting_fee transaction created for driver with amount -200', async () => {
  const driverId = await getUserId('testdriver@test.com')
  const riderId  = await getUserId('testrider@test.com')
  const ride = await createTestRide(driverId)
  await book(ride.id, riderId, 1)
  const { data: txn } = await db.from('wallet_transactions')
    .select('*').eq('user_id', driverId).eq('type', 'posting_fee')
    .order('created_at', { ascending: false }).limit(1).single()
  assertEquals(txn?.amount, -200)
  await cleanup(ride.id)
})

Deno.test('T12 - Fails for a full ride', async () => {
  const driverId = await getUserId('testdriver@test.com')
  const riderId  = await getUserId('testrider@test.com')
  const ride = await createTestRide(driverId, 150, 1)
  await book(ride.id, riderId, 1) // fills it
  // Use a different rider
  const { data } = await book(ride.id, riderId, 1)
  assertEquals(data?.success, false)
  await cleanup(ride.id)
})

Deno.test('T13 - Fails for a cancelled ride', async () => {
  const driverId = await getUserId('testdriver@test.com')
  const riderId  = await getUserId('testrider@test.com')
  const ride = await createTestRide(driverId)
  await db.from('rides').update({ status: 'cancelled' }).eq('id', ride.id)
  const { data } = await book(ride.id, riderId, 1)
  assertEquals(data?.success, false)
  await cleanup(ride.id)
})

Deno.test('T14 - Fails when driver tries to book own ride', async () => {
  const driverId = await getUserId('testdriver@test.com')
  const ride = await createTestRide(driverId)
  const { data } = await book(ride.id, driverId, 1)
  assertEquals(data?.success, false)
  await cleanup(ride.id)
})

Deno.test('T15 - Fails when rider wallet balance is zero', async () => {
  const driverId = await getUserId('testdriver@test.com')
  const riderId  = await getUserId('testrider@test.com')
  await setWallet(riderId, 0)
  const ride = await createTestRide(driverId)
  const { data } = await book(ride.id, riderId, 1)
  assertEquals(data?.success, false)
  await setWallet(riderId, 5000)
  await cleanup(ride.id)
})

Deno.test('T16 - Fails when requesting more seats than available', async () => {
  const driverId = await getUserId('testdriver@test.com')
  const riderId  = await getUserId('testrider@test.com')
  const ride = await createTestRide(driverId, 150, 1)
  const { data } = await book(ride.id, riderId, 5)
  assertEquals(data?.success, false)
  await cleanup(ride.id)
})

Deno.test('T17 - Booking row persisted in bookings table', async () => {
  const driverId = await getUserId('testdriver@test.com')
  const riderId  = await getUserId('testrider@test.com')
  const ride = await createTestRide(driverId)
  const { data } = await book(ride.id, riderId, 1)
  const { data: row } = await db.from('bookings').select('*').eq('id', data?.booking?.id).single()
  assertExists(row)
  assertEquals(row?.rider_id, riderId)
  await cleanup(ride.id)
})

Deno.test('T18 - Wallet balances unchanged when booking fails', async () => {
  const driverId = await getUserId('testdriver@test.com')
  const riderId  = await getUserId('testrider@test.com')
  await setWallet(riderId, 5000)
  await setWallet(driverId, 5000)
  const ride = await createTestRide(driverId)
  await db.from('rides').update({ status: 'cancelled' }).eq('id', ride.id)
  await book(ride.id, riderId, 1)
  assertEquals(await getWallet(riderId), 5000)
  assertEquals(await getWallet(driverId), 5000)
  await cleanup(ride.id)
})
