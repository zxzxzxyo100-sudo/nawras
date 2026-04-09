/**
 * مهام مسؤول المتاجر النشطة من active-workflow.php — حسب سجل المكالمات اليوم والتعيين فقط.
 */
export function workflowRowsToAssignedTasks(rows, wfStatus, allStores) {
  const list = Array.isArray(rows) ? rows : []
  const out = []
  for (const r of list) {
    const store = allStores.find(s => String(s.id) === String(r.store_id))
    if (!store) continue
    const label =
      wfStatus === 'completed'
        ? 'منجز اليوم'
        : wfStatus === 'no_answer'
          ? 'لم يرد / مشغول'
          : 'متابعة دورية'
    const desc =
      wfStatus === 'no_answer'
        ? 'مكالمة اليوم كانت لم يرد أو مشغول — أعد الاتصال ثم «تم الرد» واستبيان الرضا للمنجز'
        : wfStatus === 'completed'
          ? 'تم الرد وحُفظ استبيان الرضا اليوم — يُحتسب في الإنتاجية'
          : 'بلا مكالمة مسجّلة اليوم لهذا التعيين — سجّل المكالمة من الدرج'
    out.push({
      id: `${store.id}-am-${wfStatus}`,
      store,
      type: 'assigned_store',
      label,
      desc,
      priority: 'normal',
      wfStatus,
      moContactedToday: wfStatus === 'completed',
      amTaskInDelays: false,
    })
  }
  return out
}

/** صفوف مختلطة (كل المعيّنات) — workflow_status من الخادم */
export function workflowMixedAssignedRowsToTasks(rows, allStores) {
  const out = []
  for (const r of rows || []) {
    const ws = String(r.workflow_status || 'active').trim()
    const st = ws === 'completed' ? 'completed' : ws === 'no_answer' ? 'no_answer' : 'active'
    const chunk = workflowRowsToAssignedTasks([r], st, allStores)
    if (chunk[0]) out.push(chunk[0])
  }
  return out
}
