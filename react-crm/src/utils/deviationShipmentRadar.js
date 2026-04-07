/**
 * رادار انحراف الشحنات: مقارنة أسبوع بأسبوع ضمن آخر 14 يوماً حتى اليوم.
 * الأسبوع «الأقدم»: من اليوم-13 إلى اليوم-7 — الأسبوع «الأحدث»: من اليوم-6 إلى اليوم (كلاهما 7 أيام تقويمية).
 */

/** الحد الأدنى لشحنات الأسبوع الأول لاعتبار المتجر ضمن الرادار (تصفية الضوضاء) */
export const DEVIATION_MIN_FIRST_WEEK_SHIPMENTS = 50

/**
 * @returns {{ week1: { from: string, to: string }, week2: { from: string, to: string }, asOf: string }}
 */
export function getRollingTwoWeekShipmentWindows() {
  const today = new Date()
  today.setHours(12, 0, 0, 0)

  const w2End = new Date(today)
  const w2Start = new Date(today)
  w2Start.setDate(w2Start.getDate() - 6)

  const w1End = new Date(today)
  w1End.setDate(w1End.getDate() - 7)
  const w1Start = new Date(today)
  w1Start.setDate(w1Start.getDate() - 13)

  const fmt = d => {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }

  return {
    week1: { from: fmt(w1Start), to: fmt(w1End) },
    week2: { from: fmt(w2Start), to: fmt(w2End) },
    asOf: fmt(today),
  }
}
