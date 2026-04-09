/**
 * مهام مسؤول المتاجر النشطة من active-workflow.php فقط.
 *
 * — المتابعة الدورية: لم تُسجَّل للمتجر مكالمة اليوم.
 * — عدم الرد: بعد «لم يرد» أو «مشغول» حتى يُكمل «تم الرد» + استبيان.
 * — المنجزة: بعد حفظ استبيان الرضا عقب «تم الرد».
 */
export function workflowRowsToAssignedTasks(rows, wfStatus, allStores) {
  const list = Array.isArray(rows) ? rows : []
  const out = []
  for (const r of list) {
    const store = allStores.find(s => String(s.id) === String(r.store_id))
    if (!store) continue
    const label =
      wfStatus === 'completed'
        ? 'متجر منجز'
        : wfStatus === 'no_answer'
          ? 'في عدم الرد'
          : 'متابعة دورية'
    const desc =
      wfStatus === 'no_answer'
        ? 'اتصل مجدداً، اختر «تم الرد»، وأكمل استبيان الرضا لنقله إلى المنجزة'
        : wfStatus === 'completed'
          ? 'أُنجز باستبيان الرضا بعد «تم الرد»'
          : 'تعيين نشط — في «المتابعة الدورية» يظهر فقط من بلا مكالمة اليوم؛ بعد «تم الرد» أكمل الاستبيان للمنجز، و«لم يرد»/«مشغول» ينقل لعدم الرد'
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
