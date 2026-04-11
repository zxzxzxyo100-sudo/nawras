/** أول وآخر يوم من الشهر التقويمي الحالي (محلي) — لقيم input type="date" */

export function defaultCalendarMonthYmd() {
  const d = new Date()
  const y = d.getFullYear()
  const m = d.getMonth()
  const pad = (n) => String(n).padStart(2, '0')
  const from = `${y}-${pad(m + 1)}-01`
  const lastDay = new Date(y, m + 1, 0).getDate()
  const to = `${y}-${pad(m + 1)}-${pad(lastDay)}`
  return { from, to }
}

/** مقارنة سليمة لسلاسل YYYY-MM-DD */
export function isValidYmdRange(from, to) {
  if (!from || !to || from.length !== 10 || to.length !== 10) return false
  return from <= to
}
