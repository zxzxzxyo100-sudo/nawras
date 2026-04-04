/** بعد الاستعادة التلقائية (طلبية جديدة) يخزّن الـ API «recovered»؛ التحديث اليدوي قد يستخدم «restored». */
export function isRestoredCategory(category) {
  return category === 'restored' || category === 'recovered'
}
