/**
 * تذاكر الانحراف — نص الجسم (إحصائيات الرادار + سكربت الاستعادة) وبناء رابط واتساب.
 */

export function daysSinceLastShipment(store) {
  if (!store?.last_shipment_date || store.last_shipment_date === 'لا يوجد') return null
  const d = new Date(store.last_shipment_date)
  if (Number.isNaN(d.getTime())) return null
  return Math.floor((Date.now() - d.getTime()) / 86400000)
}

export function buildWhatsAppUrl(phone) {
  if (phone == null || String(phone).trim() === '') return ''
  let digits = String(phone).replace(/\D/g, '')
  if (!digits) return ''
  if (digits.startsWith('0')) digits = `966${digits.slice(1)}`
  return `https://wa.me/${digits}`
}

export function buildDeviationTicketBody(store, shipmentsRangeMeta) {
  const days = daysSinceLastShipment(store)
  const range =
    shipmentsRangeMeta?.from && shipmentsRangeMeta?.to
      ? `نطاق احتساب الطرود (الرادار): من ${shipmentsRangeMeta.from} إلى ${shipmentsRangeMeta.to}`
      : ''
  const lines = [
    '— لقطة الرادار —',
    `معرّف المتجر: ${store?.id ?? '—'}`,
    `اسم المتجر: ${store?.name ?? '—'}`,
    store?.last_shipment_date && store.last_shipment_date !== 'لا يوجد'
      ? `تاريخ آخر شحنة: ${store.last_shipment_date}`
      : 'تاريخ آخر شحنة: غير متوفر',
    days != null ? `أيام منذ آخر شحنة: ${days}` : '',
    range,
    '',
    '— سكربت مكالمة الاستعادة (اقرأ بوضوح للمتجر) —',
    'السلام عليكم، معكم فريق النورس. نتواصل معكم بخصوص نشاط الشحنات لديكم؛ لاحظنا تراجعاً مقارنةً بفترة الرصد الحالية.',
    'نودّ التأكد من أن كل شيء على ما يرام، وهل تحتاجون أي دعم تشغيلي أو لوجستي من جهتنا.',
    'نقدّر وقتكم، وننتظر تأكيدكم أو أقرب وقت مناسب للمتابعة.',
    '',
    'بعد المكالمة: سجّل النتيجة من صفحة المهام أو أكمل التذكرة من لوحة التحكم.',
  ]
  return lines.filter(Boolean).join('\n')
}

export function buildDeviationTicketMeta(store, shipmentsRangeMeta) {
  return {
    store_id: store?.id ?? null,
    store_name: store?.name ?? '',
    whatsapp_url: buildWhatsAppUrl(store?.phone),
    radar: {
      last_shipment_date: store?.last_shipment_date ?? null,
      days_since_ship: daysSinceLastShipment(store),
      shipments_range: shipmentsRangeMeta?.from && shipmentsRangeMeta?.to
        ? { from: shipmentsRangeMeta.from, to: shipmentsRangeMeta.to }
        : null,
    },
  }
}
