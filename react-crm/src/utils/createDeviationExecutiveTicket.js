import { createExecutivePrivateTicket } from '../services/api'
import { buildDeviationTicketBody, buildDeviationTicketMeta } from './deviationTicket'

/**
 * ينشئ تذكرة انحراف (تذاكر الانحراف) بعد تعيين متجر لمسؤول — من الرادار / المجمد.
 */
export async function createDeviationExecutiveTicket({
  executiveUsername,
  store,
  assigneeUsername,
  shipmentsRangeMeta,
}) {
  if (!executiveUsername || !assigneeUsername || !store?.id) return
  const title = `🚨 تذكرة انحراف عاجلة: ${store.name}`
  const body = buildDeviationTicketBody(store, shipmentsRangeMeta)
  const meta = buildDeviationTicketMeta(store, shipmentsRangeMeta)
  await createExecutivePrivateTicket({
    user_role: 'executive',
    username: executiveUsername,
    title,
    body,
    assignee_username: assigneeUsername,
    is_mandatory: 1,
    ticket_type: 'deviation_alert',
    store_id: store.id,
    meta_json: JSON.stringify(meta),
  })
}
