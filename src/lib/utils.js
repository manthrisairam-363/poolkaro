// ─── Time formatting ───────────────────────────────────
export function formatTime(t) {
  if (!t) return ''
  const [h, m] = t.toString().split(':')
  const hr = parseInt(h)
  const min = m?.slice(0, 2) || '00'
  const period = hr >= 12 ? 'PM' : 'AM'
  const displayHr = hr > 12 ? hr - 12 : hr === 0 ? 12 : hr
  return `${displayHr}:${min} ${period}`
}

// ─── Date formatting ───────────────────────────────────
export function formatDate(d, short = false) {
  if (!d) return ''
  const date = new Date(d)
  const today = new Date()
  const tomorrow = new Date(today)
  tomorrow.setDate(today.getDate() + 1)

  if (date.toDateString() === today.toDateString()) return 'Today'
  if (date.toDateString() === tomorrow.toDateString()) return 'Tomorrow'

  if (short) {
    return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
  }
  return date.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })
}

// ─── Full date + time ──────────────────────────────────
export function formatDateTime(date, time) {
  return `${formatDate(date)} · ${formatTime(time)}`
}

// ─── Rupees ────────────────────────────────────────────
export function formatRupees(amount) {
  return `₹${Number(amount).toLocaleString('en-IN')}`
}
