/**
 * book-ride.test.ts — 18 tests
 * Run: deno test --allow-net --allow-env --jobs=1 tests/deno/book-ride.test.ts
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { assertEquals, assertExists } from 'https://deno.land/std@0.208.0/assert/mod.ts'

const URL = Deno.env.get('SUPABASE_URL')!
const KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const db  = createClient(URL, KEY, { auth: { autoRefreshToken: false, persistSession: false } })

async function getUserId(email: string) {
  const { data } = await db.from('profiles').select('id').eq('email', email).maybeSingle()
  if (!data) throw new Error(`User not found: ${email}`)
  return data.id as string
}
async function getWallet(uid: string) {
  const { data } = await db.from('wallets').select('balance').eq('user_id', uid).maybeSingle()
  return data?.balance ?? 0
}
async function setWallet(uid: string, balance: number) {
  await db.from('wallets').update({ balance }).eq('user_id', uid)
}
async function createRide(driverId: string, fare = 150, seats = 3) {
  const tag = `TEST_${Date.now()}_${Math.random().toString(36).slice(2,6)}`
  const { data, error } = await db.from('rides').insert({
    driver_id: driverId,
    from_location: tag,
    to_location: tag + '_dst',
    ride_date: new Date(Date.now() + 86400000).toISOString().split('T')[0],
    ride_time: '09:00', fare, seats_total: seats, seats_available: seats,
    status: 'active', ride_type: 'to_office', is_recurring: false,
  }).select().single()
  if (error) throw new Error('createRide failed: ' + error.message)
  return data!
}
async function cleanup(rideId: string) {
  await db.from('wallet_transactions').delete().eq('type', 'booking_fee').filter('description', 'like', 'Platform fee%')
  await db.from('wallet_transactions').delete().eq('type', 'posting_fee')
  await db.from('wallet_transactions').delete().eq('type', 'refund_cancel')
  await db.from('bookings').delete().eq('ride_id', rideId)
  await db.from('rides').delete().eq('id', rideId)
}
async function book(rideId: string, riderId: string, seats = 1) {
  return db.rpc('book_ride_atomic', { p_ride_id: rideId, p_rider_id: riderId, p_seats: seats })
}

// Clean up leftover test rides from previous runs
Deno.test('setup', async () => {
  const driverId = await getUserId('testdriver@test.com')
  const riderId  = await getUserId('testrider@test.com')
  await setWallet(driverId, 50000)
  await setWallet(riderId, 50000)
  // Delete any leftover TEST_ rides
  const { data: leftover } = await db.from('rides').select('id').like('from_location', 'TEST_%')
  for (const r of leftover || []) {
    await db.from('bookings').delete().eq('ride_id', r.id)
    await db.from('rides').delete().eq('id', r.id)
  }
  assertExists(driverId)
  assertExists(riderId)
})

Deno.test('T01 - Returns success: true', async () => {
  const driverId = await getUserId('testdriver@test.com')
  const riderId  = await getUserId('testrider@test.com')
  await setWallet(driverId, 50000); await setWallet(riderId, 50000)
  const ride = await createRide(driverId)
  try {
    const { data } = await book(ride.id, riderId)
    assertEquals(data?.success, true)
  } finally { await cleanup(ride.id) }
})

Deno.test('T02 - Booking has status: confirmed and payment_status: paid', async () => {
  const driverId = await getUserId('testdriver@test.com')
  const riderId  = await getUserId('testrider@test.com')
  await setWallet(driverId, 50000); await setWallet(riderId, 50000)
  const ride = await createRide(driverId)
  try {
    const { data } = await book(ride.id, riderId)
    assertEquals(data?.booking?.status, 'confirmed')
    assertEquals(data?.booking?.payment_status, 'paid')
  } finally { await cleanup(ride.id) }
})

Deno.test('T03 - Decrements seats_available by seats booked', async () => {
  const driverId = await getUserId('testdriver@test.com')
  const riderId  = await getUserId('testrider@test.com')
  await setWallet(driverId, 50000); await setWallet(riderId, 50000)
  const ride = await createRide(driverId, 150, 3)
  try {
    await book(ride.id, riderId, 1)
    const { data: r } = await db.from('rides').select('seats_available').eq('id', ride.id).single()
    assertEquals(r?.seats_available, 2)
  } finally { await cleanup(ride.id) }
})

Deno.test('T04 - Marks ride as full when last seat taken', async () => {
  const driverId = await getUserId('testdriver@test.com')
  const riderId  = await getUserId('testrider@test.com')
  await setWallet(driverId, 50000); await setWallet(riderId, 50000)
  const ride = await createRide(driverId, 150, 1)
  try {
    await book(ride.id, riderId, 1)
    const { data: r } = await db.from('rides').select('status, seats_available').eq('id', ride.id).single()
    assertEquals(r?.status, 'full')
    assertEquals(r?.seats_available, 0)
  } finally { await cleanup(ride.id) }
})

Deno.test('T05 - Ride stays active when seats remain', async () => {
  const driverId = await getUserId('testdriver@test.com')
  const riderId  = await getUserId('testrider@test.com')
  await setWallet(driverId, 50000); await setWallet(riderId, 50000)
  const ride = await createRide(driverId, 150, 3)
  try {
    await book(ride.id, riderId, 1)
    const { data: r } = await db.from('rides').select('status').eq('id', ride.id).single()
    assertEquals(r?.status, 'active')
  } finally { await cleanup(ride.id) }
})

Deno.test('T06 - fare=150, 1 seat → total_paid=152, driver_receives=148, platform_fee=2', async () => {
  const driverId = await getUserId('testdriver@test.com')
  const riderId  = await getUserId('testrider@test.com')
  await setWallet(driverId, 50000); await setWallet(riderId, 50000)
  const ride = await createRide(driverId, 150, 3)
  try {
    const { data } = await book(ride.id, riderId, 1)
    assertEquals(data?.booking?.total_paid, 152)
    assertEquals(data?.booking?.driver_receives, 148)
    assertEquals(data?.booking?.platform_fee, 2)
  } finally { await cleanup(ride.id) }
})

Deno.test('T07 - fare=100, 2 seats → total_paid=204, driver_receives=196, seats_booked=2', async () => {
  const driverId = await getUserId('testdriver@test.com')
  const riderId  = await getUserId('testrider@test.com')
  await setWallet(driverId, 50000); await setWallet(riderId, 50000)
  const ride = await createRide(driverId, 100, 3)
  try {
    const { data } = await book(ride.id, riderId, 2)
    assertEquals(data?.booking?.total_paid, 204)
    assertEquals(data?.booking?.driver_receives, 196)
    assertEquals(data?.booking?.seats_booked, 2)
  } finally { await cleanup(ride.id) }
})

Deno.test('T08 - Rider wallet deducted 200 paise per seat', async () => {
  const driverId = await getUserId('testdriver@test.com')
  const riderId  = await getUserId('testrider@test.com')
  await setWallet(driverId, 50000); await setWallet(riderId, 50000)
  const ride = await createRide(driverId)
  try {
    await book(ride.id, riderId, 1)
    assertEquals(await getWallet(riderId), 49800)
  } finally { await cleanup(ride.id) }
})

Deno.test('T09 - Driver wallet deducted 200 paise per seat', async () => {
  const driverId = await getUserId('testdriver@test.com')
  const riderId  = await getUserId('testrider@test.com')
  await setWallet(driverId, 50000); await setWallet(riderId, 50000)
  const ride = await createRide(driverId)
  try {
    await book(ride.id, riderId, 1)
    assertEquals(await getWallet(driverId), 49800)
  } finally { await cleanup(ride.id) }
})

Deno.test('T10 - booking_fee transaction for rider with amount -200', async () => {
  const driverId = await getUserId('testdriver@test.com')
  const riderId  = await getUserId('testrider@test.com')
  await setWallet(driverId, 50000); await setWallet(riderId, 50000)
  const ride = await createRide(driverId)
  try {
    await book(ride.id, riderId, 1)
    const { data: txn } = await db.from('wallet_transactions')
      .select('amount, type').eq('user_id', riderId).eq('type', 'booking_fee')
      .order('created_at', { ascending: false }).limit(1).single()
    assertEquals(txn?.amount, -200)
    assertEquals(txn?.type, 'booking_fee')
  } finally { await cleanup(ride.id) }
})

Deno.test('T11 - posting_fee transaction for driver with amount -200', async () => {
  const driverId = await getUserId('testdriver@test.com')
  const riderId  = await getUserId('testrider@test.com')
  await setWallet(driverId, 50000); await setWallet(riderId, 50000)
  const ride = await createRide(driverId)
  try {
    await book(ride.id, riderId, 1)
    const { data: txn } = await db.from('wallet_transactions')
      .select('amount, type').eq('user_id', driverId).eq('type', 'posting_fee')
      .order('created_at', { ascending: false }).limit(1).single()
    assertEquals(txn?.amount, -200)
  } finally { await cleanup(ride.id) }
})

Deno.test('T12 - Fails for a full ride', async () => {
  const driverId = await getUserId('testdriver@test.com')
  const riderId  = await getUserId('testrider@test.com')
  await setWallet(driverId, 50000); await setWallet(riderId, 50000)
  const ride = await createRide(driverId, 150, 1)
  try {
    await book(ride.id, riderId, 1) // fills it
    await db.from('rides').update({ status: 'full' }).eq('id', ride.id)
    const { data } = await book(ride.id, riderId, 1)
    assertEquals(data?.success, false)
  } finally { await cleanup(ride.id) }
})

Deno.test('T13 - Fails for a cancelled ride', async () => {
  const driverId = await getUserId('testdriver@test.com')
  const riderId  = await getUserId('testrider@test.com')
  const ride = await createRide(driverId)
  try {
    await db.from('rides').update({ status: 'cancelled' }).eq('id', ride.id)
    const { data } = await book(ride.id, riderId, 1)
    assertEquals(data?.success, false)
  } finally { await cleanup(ride.id) }
})

Deno.test('T14 - Fails when driver tries to book own ride', async () => {
  const driverId = await getUserId('testdriver@test.com')
  await setWallet(driverId, 50000)
  const ride = await createRide(driverId)
  try {
    const { data } = await book(ride.id, driverId, 1)
    assertEquals(data?.success, false)
  } finally { await cleanup(ride.id) }
})

Deno.test('T15 - Fails when rider wallet balance is zero', async () => {
  const driverId = await getUserId('testdriver@test.com')
  const riderId  = await getUserId('testrider@test.com')
  await setWallet(driverId, 50000); await setWallet(riderId, 0)
  const ride = await createRide(driverId)
  try {
    const { data } = await book(ride.id, riderId, 1)
    assertEquals(data?.success, false)
  } finally {
    await setWallet(riderId, 50000)
    await cleanup(ride.id)
  }
})

Deno.test('T16 - Fails when requesting more seats than available', async () => {
  const driverId = await getUserId('testdriver@test.com')
  const riderId  = await getUserId('testrider@test.com')
  await setWallet(driverId, 50000); await setWallet(riderId, 50000)
  const ride = await createRide(driverId, 150, 1)
  try {
    const { data } = await book(ride.id, riderId, 5)
    assertEquals(data?.success, false)
  } finally { await cleanup(ride.id) }
})

Deno.test('T17 - Booking row persisted in bookings table', async () => {
  const driverId = await getUserId('testdriver@test.com')
  const riderId  = await getUserId('testrider@test.com')
  await setWallet(driverId, 50000); await setWallet(riderId, 50000)
  const ride = await createRide(driverId)
  try {
    const { data } = await book(ride.id, riderId, 1)
    const { data: row } = await db.from('bookings').select('id, rider_id').eq('id', data?.booking?.id).single()
    assertExists(row)
    assertEquals(row?.rider_id, riderId)
  } finally { await cleanup(ride.id) }
})

Deno.test('T18 - Wallet balances unchanged when booking fails', async () => {
  const driverId = await getUserId('testdriver@test.com')
  const riderId  = await getUserId('testrider@test.com')
  await setWallet(driverId, 50000); await setWallet(riderId, 50000)
  const ride = await createRide(driverId)
  try {
    await db.from('rides').update({ status: 'cancelled' }).eq('id', ride.id)
    await book(ride.id, riderId, 1)
    assertEquals(await getWallet(riderId), 50000)
    assertEquals(await getWallet(driverId), 50000)
  } finally { await cleanup(ride.id) }
})
