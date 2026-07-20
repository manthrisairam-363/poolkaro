// Single source of truth for "can this driver post/keep a ride at this time?"
//
// A driver has one car and can only be in one place at a time, so the real
// constraint is NOT "same route twice" — it's any two rides of theirs whose
// start times are too close together on the same date, regardless of route.
//
// Both PostRide and EditRide must use this. If only one screen validates,
// a driver can post at a legal time and then edit it back into a conflict.

export const CONFLICT_WINDOW_MIN = 90

const toMin = t => {
  const [h, m] = String(t || '').slice(0, 5).split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}
const norm = s => String(s || '').trim().toLowerCase()

/**
 * Finds the driver's existing rides that clash with the given date(s) + time.
 * Returns [{ id, ride_date, ride_time, from_location, to_location, sameRoute }]
 */
export async function findRideConflicts({
  supabase,
  driverId,
  dates,
  time,
  from,
  to,
  excludeRideId = null,
  windowMin = CONFLICT_WINDOW_MIN,
}) {
  if (!driverId || !dates?.length || !time) return []

  let q = supabase
    .from('rides')
    .select('id, ride_date, ride_time, from_location, to_location')
    .eq('driver_id', driverId)
    .in('status', ['active', 'full'])
    .in('ride_date', dates)

  if (excludeRideId) q = q.neq('id', excludeRideId)

  const { data } = await q

  return (data || [])
    .filter(r => Math.abs(toMin(r.ride_time) - toMin(time)) <= windowMin)
    .map(r => ({
      ...r,
      sameRoute:
        norm(r.from_location) === norm(from) &&
        norm(r.to_location) === norm(to),
    }))
}

export const fmtDate = d =>
  new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })

export const fmtTime = t => String(t || '').slice(0, 5)

/** Wording differs: repeating the same ride vs. being double-booked elsewhere. */
export function conflictMessage(c) {
  return c.sameRoute
    ? `⚠️ You've already posted this ride\n\n` +
      `${c.from_location} → ${c.to_location}\n` +
      `${fmtDate(c.ride_date)} at ${fmtTime(c.ride_time)}\n\n` +
      `Edit that ride from "My Rides" instead of posting a new one.`
    : `⚠️ You already have a ride at this time\n\n` +
      `${c.from_location} → ${c.to_location}\n` +
      `${fmtDate(c.ride_date)} at ${fmtTime(c.ride_time)}\n\n` +
      `You can't drive two rides at once. Choose a time at least ` +
      `${CONFLICT_WINDOW_MIN} minutes apart, or edit the existing ride.`
}
