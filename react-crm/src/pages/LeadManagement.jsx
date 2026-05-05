import { useEffect, useState } from 'react'
import { Loader2, Plus, Phone, UserCheck } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { getLeads, createLead, updateLeadById } from '../services/api'

const INITIAL_FORM = {
  store_name: '',
  phone_number: '',
  source: 'social_media',
}

const SOURCE_OPTIONS = [
  { value: 'social_media', label: 'Social Media' },
  { value: 'field_visit', label: 'Field Visit' },
  { value: 'referral', label: 'Referral' },
]

function formatDate(value) {
  if (!value) return '-'
  try {
    return new Date(value).toLocaleString('ar-IQ', { hour12: true })
  } catch {
    return value
  }
}

export default function LeadManagement() {
  const { user } = useAuth()
  const [formData, setFormData] = useState(INITIAL_FORM)
  const [leads, setLeads] = useState([])
  const [loadingList, setLoadingList] = useState(true)
  const [creating, setCreating] = useState(false)
  const [updatingLeadId, setUpdatingLeadId] = useState(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const username = user?.fullname || user?.username || 'Unknown'

  async function fetchLeads() {
    setLoadingList(true)
    setError('')
    const res = await getLeads(user?.id)
    if (!res?.success) {
      setError(res?.error || 'تعذّر تحميل قائمة العملاء المحتملين.')
      setLeads([])
    } else {
      setLeads(res.data || [])
    }
    setLoadingList(false)
  }

  useEffect(() => {
    void fetchLeads()
  }, [user?.id])

  function handleFormChange(event) {
    const { name, value } = event.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  async function handleCreateLead(event) {
    event.preventDefault()
    if (!formData.store_name.trim() || !formData.phone_number.trim()) {
      setError('يرجى إدخال اسم المتجر ورقم الهاتف.')
      return
    }

    setCreating(true)
    setError('')
    setSuccess('')

    const payload = {
      store_name: formData.store_name.trim(),
      phone_number: formData.phone_number.trim(),
      source: formData.source,
      assigned_to: user?.id || null,
    }

    const res = await createLead(payload)
    if (!res?.success) {
      setError(res?.error || 'فشل إضافة العميل المحتمل.')
    } else {
      setSuccess('تمت إضافة العميل المحتمل بنجاح.')
      setFormData(INITIAL_FORM)
      await fetchLeads()
    }

    setCreating(false)
  }

  async function updateLead(leadId, patch) {
    setUpdatingLeadId(leadId)
    setError('')
    setSuccess('')

    const res = await updateLeadById(leadId, patch)
    if (!res?.success) {
      setError(res?.error || 'فشل تحديث العميل المحتمل.')
    } else {
      setSuccess('تم تحديث حالة العميل المحتمل.')
      await fetchLeads()
    }
    setUpdatingLeadId(null)
  }

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h1 className="text-xl font-black text-slate-900">جمع البيانات والمتابعة</h1>
        <p className="mt-1 text-sm text-slate-500">إدارة العملاء المحتملين ومتابعة دورة التحويل خطوة بخطوة.</p>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <Plus size={16} className="text-violet-600" />
          <h2 className="text-base font-bold text-slate-900">إضافة عميل محتمل</h2>
        </div>

        <form onSubmit={handleCreateLead} className="grid gap-3 md:grid-cols-4">
          <input
            name="store_name"
            value={formData.store_name}
            onChange={handleFormChange}
            placeholder="اسم المتجر"
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none ring-violet-200 transition focus:border-violet-300 focus:ring"
          />
          <input
            name="phone_number"
            value={formData.phone_number}
            onChange={handleFormChange}
            placeholder="رقم الهاتف"
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none ring-violet-200 transition focus:border-violet-300 focus:ring"
          />
          <select
            name="source"
            value={formData.source}
            onChange={handleFormChange}
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none ring-violet-200 transition focus:border-violet-300 focus:ring"
          >
            {SOURCE_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <button
            type="submit"
            disabled={creating}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-3 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {creating ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
            إضافة
          </button>
        </form>
      </section>

      {(error || success) && (
        <div className={`rounded-xl border px-4 py-2 text-sm ${error ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>
          {error || success}
        </div>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <UserCheck size={16} className="text-violet-600" />
          <h2 className="text-base font-bold text-slate-900">العملاء المكلّفون لي</h2>
        </div>

        {loadingList ? (
          <div className="flex items-center justify-center gap-2 py-10 text-slate-500">
            <Loader2 size={16} className="animate-spin" />
            جارٍ تحميل البيانات...
          </div>
        ) : leads.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 py-10 text-center text-sm text-slate-500">
            لا توجد بيانات حالياً.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-right text-slate-500">
                <tr className="border-b border-slate-200">
                  <th className="px-3 py-2 font-semibold">المتجر</th>
                  <th className="px-3 py-2 font-semibold">الهاتف</th>
                  <th className="px-3 py-2 font-semibold">المصدر</th>
                  <th className="px-3 py-2 font-semibold">حالة التواصل</th>
                  <th className="px-3 py-2 font-semibold">زيارة ميدانية</th>
                  <th className="px-3 py-2 font-semibold">فتح الحساب</th>
                  <th className="px-3 py-2 font-semibold">الإجراءات</th>
                </tr>
              </thead>
              <tbody>
                {leads.map(lead => {
                  const busy = updatingLeadId === lead.id
                  const answered = lead.contact_status === 'answered'
                  const canMarkVisitDone = answered && lead.requires_field_visit && !lead.field_visit_done
                  const canOpenAccount = answered && (!lead.requires_field_visit || lead.field_visit_done) && !lead.account_opened
                  return (
                    <tr key={lead.id} className="border-b border-slate-100 align-top">
                      <td className="px-3 py-3 font-semibold text-slate-900">
                        {lead.store_name}
                        <div className="mt-1 text-xs font-normal text-slate-500">{formatDate(lead.created_at)}</div>
                      </td>
                      <td className="px-3 py-3 text-slate-700">
                        <div className="inline-flex items-center gap-1">
                          <Phone size={13} />
                          {lead.phone_number}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-slate-700">{lead.source || '-'}</td>
                      <td className="px-3 py-3 text-slate-700">{lead.contact_status || 'pending'}</td>
                      <td className="px-3 py-3 text-slate-700">
                        {lead.requires_field_visit ? (lead.field_visit_done ? 'تمت الزيارة' : 'مطلوبة') : 'غير مطلوبة'}
                      </td>
                      <td className="px-3 py-3 text-slate-700">{lead.account_opened ? 'تم الفتح' : 'لم يتم'}</td>
                      <td className="px-3 py-3">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => updateLead(lead.id, { contact_status: 'answered' })}
                            className="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-60"
                          >
                            Answered
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => updateLead(lead.id, { contact_status: 'no_answer' })}
                            className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 hover:bg-amber-100 disabled:opacity-60"
                          >
                            No Answer
                          </button>

                          {answered && (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => updateLead(lead.id, { requires_field_visit: !lead.requires_field_visit })}
                              className="rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 disabled:opacity-60"
                            >
                              {lead.requires_field_visit ? 'Cancel Field Visit' : 'Require Field Visit?'}
                            </button>
                          )}

                          {canMarkVisitDone && (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => updateLead(lead.id, { field_visit_done: true })}
                              className="rounded-lg border border-cyan-200 bg-cyan-50 px-2.5 py-1 text-xs font-semibold text-cyan-700 hover:bg-cyan-100 disabled:opacity-60"
                            >
                              Mark Visit as Done
                            </button>
                          )}

                          <button
                            type="button"
                            disabled={busy || !canOpenAccount}
                            onClick={() => updateLead(lead.id, { account_opened: true })}
                            className="rounded-lg border border-violet-200 bg-violet-50 px-2.5 py-1 text-xs font-semibold text-violet-700 hover:bg-violet-100 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            Open Account
                          </button>

                          {busy && <Loader2 size={14} className="animate-spin text-slate-400" />}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <p className="text-xs text-slate-400">User: {username}</p>
    </div>
  )
}
