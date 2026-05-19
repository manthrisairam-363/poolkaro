/**
 * cancel-booking.test.ts — 17 tests
 * Run: deno test --allow-net --allow-env cancel-booking.test.ts
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
async function setWallet(uid: string, bal: number) {
  await db.from('wallets').upsert({ user_id: uid, balance: bal }, { onConflict: 'user_id' })
}
async function createRide(driverId: string, seats = 3) {
  const { data } = await db.from('rides').insert({
    driver_id: driverId, from_location: 'TEST_Uppal', to_location: 'TEST_Kokapet',
    ride_date: new Date(Date.now() + 86400000).toISOString().split('T')[0],
    ride_time: '09:00', fare: 150, seats_total: seats, seats_available: seats,
    status: 'active', ride_type: 'to_office', is_recurring: false,
  }).select().single()
  return data!
}
async function bookRide(rideId: string, riderId: string, seats = 1) {
  const { data } = await db.rpc('book_ride_atomic', { p_ride_id: rideId, p_rider_id: riderId, p_seats: seats })
  return data
}
async function cancelBooking(bookingId: string, riderId: string) {
  return db.rpc('cancel_booking_atomic', { p_booking_id: bookingId, p_rider_id: riderId })
}
async function cleanup() {
  const { data: rides } = await db.from('rides').select('id').eq('from_location', 'TEST_Uppal')
  for (const r of rides || []) {
    await db.from('wallet_transactions').delete()
      .in('type', ['booking_fee', 'posting_fee', 'refund_cancel'])
      .like('description', '%TEST_%')
    await db.from('bookings').delete().eq('ride_id', r.id)
    await db.from('rides').delete().eq('id', r.id)
  }
}

Deno.test('CB_T01 - Returns success: true', async () => {
  const driverId = await getUserId('testdriver@test.com')
  const riderId  = await getUserId('testrider@test.com')
  await setWallet(driverId, 5000); await setWallet(riderId, 5000)
  const ride = await createRide(driverId)
  const booking = await bookRide(ride.id, riderId)
  const { data } = await cancelBooking(booking.booking.id, riderId)
  assertEquals(data?.success, true)
  await cleanup()
})

Deno.test('CB_T02 - Booking status becomes cancelled', async () => {
  const driverId = await getUserId('testdriver@test.com')
  const riderId  = await getUserId('testrider@test.com')
  await setWallet(driverId, 5000); await setWallet(riderId, 5000)
  const ride = await createRide(driverId)
  const booking = await bookRide(ride.id, riderId)
  await cancelBooking(booking.booking.id, riderId)
  const { data: b } = await db.from('bookings').select('status').eq('id', booking.booking.id).single()
  assertEquals(b?.status, 'cancelled')
  await cleanup()
})

Deno.test('CB_T03 - cancelled_at timestamp is set', async () => {
  const driverId = await getUserId('testdriver@test.com')
  const riderId  = await getUserId('testrider@test.com')
  await setWallet(driverId, 5000); await setWallet(riderId, 5000)
  const ride = await createRide(driverId)
  const booking = await bookRide(ride.id, riderId)
  await cancelBooking(booking.booking.id, riderId)
  const { data: b } = await db.from('bookings').select('cancelled_at').eq('id', booking.booking.id).single()
  assertExists(b?.cancelled_at)
  await cleanup()
})

Deno.test('CB_T04 - Restores seats_available on the ride', async () => {
  const driverId = await getUserId('testdriver@test.com')
  const riderId  = await getUserId('testrider@test.com')
  await setWallet(driverId, 5000); await setWallet(riderId, 5000)
  const ride = await createRide(driverId, 3)
  const booking = await bookRide(ride.id, riderId, 1)
  await cancelBooking(booking.booking.id, riderId)
  const { data: r } = await db.from('rides').select('seats_available').eq('id', ride.id).single()
  assertEquals(r?.seats_available, 3)
  await cleanup()
})

Deno.test('CB_T05 - Ride status goes back to active', async () => {
  const driverId = await getUserId('testdriver@test.com')
  const riderId  = await getUserId('testrider@test.com')
  await setWallet(driverId, 5000); await setWallet(riderId, 5000)
  const ride = await createRide(driverId, 3)
  const booking = await bookRide(ride.id, riderId)
  await cancelBooking(booking.booking.id, riderId)
  const { data: r } = await db.from('rides').select('status').eq('id', ride.id).single()
  assertEquals(r?.status, 'active')
  await cleanup()
})

Deno.test('CB_T06 - Reopens a full ride when seat restored', async () => {
  const driverId = await getUserId('testdriver@test.com')
  const riderId  = await getUserId('testrider@test.com')
  await setWallet(driverId, 5000); await setWallet(riderId, 5000)
  const ride = await createRide(driverId, 1)
  const booking = await bookRide(ride.id, riderId, 1)
  const { data: r1 } = await db.from('rides').select('status').eq('id', ride.id).single()
  assertEquals(r1?.status, 'full')
  await cancelBooking(booking.booking.id, riderId)
  const { data: r2 } = await db.from('rides').select('status').eq('id', ride.id).single()
  assertEquals(r2?.status, 'active')
  await cleanup()
})

Deno.test('CB_T07 - Rider wallet credited 200 paise', async () => {
  const driverId = await getUserId('testdriver@test.com')
  const riderId  = await getUserId('testrider@test.com')
  await setWallet(driverId, 5000); await setWallet(riderId, 5000)
  const ride = await createRide(driverId)
  const booking = await bookRide(ride.id, riderId)
  await cancelBooking(booking.booking.id, riderId)
  assertEquals(await getWallet(riderId), 5000)
  await cleanup()
})

Deno.test('CB_T08 - Driver wallet credited 200 paise', async () => {
  const driverId = await getUserId('testdriver@test.com')
  const riderId  = await getUserId('testrider@test.com')
  await setWallet(driverId, 5000); await setWallet(riderId, 5000)
  const ride = await createRide(driverId)
  const booking = await bookRide(ride.id, riderId)
  await cancelBooking(booking.booking.id, riderId)
  assertEquals(await getWallet(driverId), 5000)
  await cleanup()
})

Deno.test('CB_T09 - refund_cancel transaction for rider includes booking_id', async () => {
  const driverId = await getUserId('testdriver@test.com')
  const riderId  = await getUserId('testrider@test.com')
  await setWallet(driverId, 5000); await setWallet(riderId, 5000)
  const ride = await createRide(driverId)
  const booking = await bookRide(ride.id, riderId)
  await cancelBooking(booking.booking.id, riderId)
  const { data: txn } = await db.from('wallet_transactions')
    .select('*').eq('user_id', riderId).eq('type', 'refund_cancel')
    .order('created_at', { ascending: false }).limit(1).single()
  assertEquals(txn?.amount, 200)
  assertEquals(txn?.booking_id, booking.booking.id)
  await cleanup()
})

Deno.test('CB_T10 - refund_cancel transaction for driver with +200', async () => {
  const driverId = await getUserId('testdriver@test.com')
  const riderId  = await getUserId('testrider@test.com')
  await setWallet(driverId, 5000); await setWallet(riderId, 5000)
  const ride = await createRide(driverId)
  const booking = await bookRide(ride.id, riderId)
  await cancelBooking(booking.booking.id, riderId)
  const { data: txn } = await db.from('wallet_transactions')
    .select('*').eq('user_id', driverId).eq('type', 'refund_cancel')
    .order('created_at', { ascending: false }).limit(1).single()
  assertEquals(txn?.amount, 200)
  await cleanup()
})

Deno.test('CB_T11 - cancellation_count incremented on profile', async () => {
  const driverId = await getUserId('testdriver@test.com')
  const riderId  = await getUserId('testrider@test.com')
  await setWallet(driverId, 5000); await setWallet(riderId, 5000)
  await db.from('profiles').update({ cancellation_count: 0 }).eq('id', riderId)
  const ride = await createRide(driverId)
  const booking = await bookRide(ride.id, riderId)
  await cancelBooking(booking.booking.id, riderId)
  const { data: p } = await db.from('profiles').select('cancellation_count').eq('id', riderId).single()
  assert((p?.cancellation_count ?? 0) >= 1)
  await cleanup()
})

Deno.test('CB_T12 - Fraud warning returned on 4th cancellation', async () => {
  const driverId = await getUserId('testdriver@test.com')
  const riderId  = await getUserId('testrider@test.com')
  await db.from('profiles').update({ cancellation_count: 3 }).eq('id', riderId)
  await setWallet(driverId, 5000); await setWallet(riderId, 5000)
  const ride = await createRide(driverId)
  const booking = await bookRide(ride.id, riderId)
  const { data } = await cancelBooking(booking.booking.id, riderId)
  assertExists(data?.warning)
  await db.from('profiles').update({ cancellation_count: 0 }).eq('id', riderId)
  await cleanup()
})

Deno.test('CB_T13 - is_verified set false on 5th+ cancellation', async () => {
  const driverId = await getUserId('testdriver@test.com')
  const riderId  = await getUserId('testrider@test.com')
  await db.from('profiles').update({ cancellation_count: 4, is_verified: true }).eq('id', riderId)
  await setWallet(driverId, 5000); await setWallet(riderId, 5000)
  const ride = await createRide(driverId)
  const booking = await bookRide(ride.id, riderId)
  await cancelBooking(booking.booking.id, riderId)
  const { data: p } = await db.from('profiles').select('is_verified').eq('id', riderId).single()
  assertEquals(p?.is_verified, false)
  await db.from('profiles').update({ cancellation_count: 0, is_verified: true }).eq('id', riderId)
  await cleanup()
})

Deno.test('CB_T14 - Fails for non-existent booking UUID', async () => {
  const riderId = await getUserId('testrider@test.com')
  const { data } = await cancelBooking('00000000-0000-0000-0000-000000000000', riderId)
  assertEquals(data?.success, false)
})

Deno.test('CB_T15 - Fails when wrong user tries to cancel', async () => {
  const driverId = await getUserId('testdriver@test.com')
  const riderId  = await getUserId('testrider@test.com')
  await setWallet(driverId, 5000); await setWallet(riderId, 5000)
  const ride = await createRide(driverId)
  const booking = await bookRide(ride.id, riderId)
  const { data } = await cancelBooking(booking.booking.id, driverId) // wrong user
  assertEquals(data?.success, false)
  await cleanup()
})

Deno.test('CB_T16 - Fails when booking already cancelled', async () => {
  const driverId = await getUserId('testdriver@test.com')
  const riderId  = await getUserId('testrider@test.com')
  await setWallet(driverId, 5000); await setWallet(riderId, 5000)
  const ride = await createRide(driverId)
  const booking = await bookRide(ride.id, riderId)
  await cancelBooking(booking.booking.id, riderId)
  const { data } = await cancelBooking(booking.booking.id, riderId) // second cancel
  assertEquals(data?.success, false)
  await cleanup()
})

Deno.test('CB_T17 - Wallet balances unchanged when cancellation fails', async () => {
  const riderId = await getUserId('testrider@test.com')
  await setWallet(riderId, 3000)
  await cancelBooking('00000000-0000-0000-0000-000000000000', riderId)
  assertEquals(await getWallet(riderId), 3000)
})
