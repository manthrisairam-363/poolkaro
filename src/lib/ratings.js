// Single source of truth for rating logic. All three places that let someone
// rate (LiveRide modal, MyRides rider→driver, MyRides driver→rider) call these,
// so they behave identically and can't disagree or double-count.
//
// The ratings table has UNIQUE(booking_id, rated_by), so the DB itself blocks a
// second rating from the same person on the same booking. We always read that
// table (never a cached booking flag) to know if someone has already rated.

import { supabase } from './supabase'

// Has `raterId` already rated on this booking?
export async function hasRated(bookingId, raterId) {
  const { data } = await supabase
    .from('ratings')
    .select('id, stars')
    .eq('booking_id', bookingId)
    .eq('rated_by', raterId)
    .maybeSingle()
  return data || null   // returns the rating row (with stars) or null
}

// What rating did `raterId` GIVE on this booking, and what did they RECEIVE?
// Used by the past-ride detail view to show both directions.
export async function getBookingRatings(bookingId) {
  const { data } = await supabase
    .from('ratings')
    .select('rated_by, rated_user, stars, comment')
    .eq('booking_id', bookingId)
  return data || []
}

// Submit a rating and recalculate the rated user's average atomically-ish.
// Returns { ok, error, duplicate }.
export async function submitRating({ bookingId, rideId, raterId, ratedUserId, stars, comment }) {
  if (!stars || stars < 1 || stars > 5) return { ok: false, error: 'Pick 1–5 stars' }

  const { error } = await supabase.from('ratings').insert({
    booking_id: bookingId,
    rated_by: raterId,
    rated_user: ratedUserId,
    ride_id: rideId,
    stars,
    comment: comment || null,
  })

  if (error) {
    // 23505 = unique violation = they already rated (from another screen)
    if (error.code === '23505') return { ok: true, duplicate: true }
    return { ok: false, error: error.message }
  }

  // Recalculate the rated user's average from ALL their ratings.
  const { data: all } = await supabase
    .from('ratings').select('stars').eq('rated_user', ratedUserId)
  if (all && all.length > 0) {
    const avg = all.reduce((s, r) => s + r.stars, 0) / all.length
    await supabase.from('profiles').update({
      avg_rating: Math.round(avg * 10) / 10,
      total_ratings: all.length,
    }).eq('id', ratedUserId)
  }

  // Notify the rated user
  await supabase.from('notifications').insert({
    user_id: ratedUserId,
    title: '⭐ You got a rating',
    message: `Someone rated you ${stars} star${stars > 1 ? 's' : ''}`,
    type: 'rating',
    booking_id: bookingId,
    is_read: false,
  })

  return { ok: true }
}