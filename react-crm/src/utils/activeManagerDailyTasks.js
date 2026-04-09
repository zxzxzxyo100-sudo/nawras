/**
 * مهام مسؤول المتاجر النشطة من طابور active-workflow.php فقط (بدون دمج منطق المهام القديم).
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
          : 'متجر مسند إليك'
    const desc =
      wfStatus === 'no_answer'
        ? 'أعد الاتصال ثم «تم الرد» واستبيان الرضا لنقله إلى المنجزة'
        : wfStatus === 'completed'
          ? 'أُنجز باستبيان رضا العميل بعد اتصال ناجح'
          : 'سجّل المكالمة واستبيان الرضا عند «تم الرد» لإكمال المتابعة'
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
