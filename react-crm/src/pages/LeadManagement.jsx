import { useEffect, useRef, useState } from 'react'
import { ExternalLink, Image, Loader2, MapPin, Pencil, Phone, Plus, Save, UserCheck, X } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { createLead, getLeads, patchLead } from '../services/api'

const INITIAL_FORM = {
  store_name: '',
  phone_number: '',
  source: 'social_media',
  website_or_location: '',
  responsible_name: '',
  region: '',
}

const SOURCE_OPTIONS = [
  { value: 'social_media', label: 'سوشال ميديا' },
  { value: 'field_visit',  label: 'زيارة ميدانية' },
  { value: 'other',        label: 'مصدر آخر' },
]

const SOURCE_LABELS = Object.fromEntries(SOURCE_OPTIONS.map(o => [o.value, o.label]))

function formatDate(value) {
  if (!value) return '-'
  try { return new Date(value).toLocaleString('ar-IQ', { hour12: true }) } catch { return value }
}

function StatusBadge({ status }) {
  const map = {
    pending:   { label: 'بانتظار التواصل', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
    answered:  { label: 'تم الرد',          cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    no_answer: { label: 'لم يرد',           cls: 'bg-rose-50 text-rose-700 border-rose-200' },
  }
  const s = map[status] ?? map.pending
  return (
    <span className={`inline-block rounded-lg border px-2 py-0.5 text-xs font-semibold ${s.cls}`}>
      {s.label}
    </span>
  )
}

function AccountIdDialog({ onConfirm, onCancel }) {
  const [accountId, setAccountId] = useState('')
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onCancel}>
      <div
        className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl"
        dir="rtl"
        onClick={e => e.stopPropagation()}
      >
        <h3 className="mb-1 text-base font-bold text-slate-900">فتح الحساب</h3>
        <p className="mb-4 text-xs text-slate-500">أدخل رقم معرف الحساب الذي تم إنشاؤه.</p>
        <input
          autoFocus
          value={accountId}
          onChange={e => setAccountId(e.target.value)}
          placeholder="معرف الحساب (Account ID)"
          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none ring-violet-200 transition focus:border-violet-300 focus:ring"
          dir="ltr"
        />
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-slate-200 px-4 py-1.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
          >
            إلغاء
          </button>
          <button
            type="button"
            onClick={() => onConfirm(accountId.trim())}
            disabled={!accountId.trim()}
            className="rounded-xl bg-violet-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
          >
            تأكيد
          </button>
        </div>
      </div>
    </div>
  )
}

function EditLeadModal({ lead, onSave, onClose }) {
  const fileInputRef = useRef(null)
  const [form, setForm] = useState({
    store_name:          lead.store_name        ?? '',
    phone_number:        lead.phone_number       ?? '',
    source:              lead.source             ?? 'social_media',
    website_or_location: lead.website_or_location ?? '',
    responsible_name:    lead.responsible_name   ?? '',
    region:              lead.region             ?? '',
  })
  const [saving, setSaving] = useState(false)

  function change(e) {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
  }

  async function handleSave() {
    setSaving(true)
    await onSave(form)
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl"
        dir="rtl"
        onClick={e => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-bold text-slate-900">تعديل بيانات العميل</h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>

        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">اسم المتجر *</label>
              <input name="store_name" value={form.store_name} onChange={change}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none ring-violet-200 focus:border-violet-300 focus:ring" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">رقم الهاتف *</label>
              <input name="phone_number" value={form.phone_number} onChange={change}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none ring-violet-200 focus:border-violet-300 focus:ring" dir="ltr" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">اسم المسؤول</label>
              <input name="responsible_name" value={form.responsible_name} onChange={change}
                placeholder="اسم الشخص المسؤول عن المتجر"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none ring-violet-200 focus:border-violet-300 focus:ring" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">المنطقة</label>
              <input name="region" value={form.region} onChange={change}
                placeholder="المنطقة الجغرافية"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none ring-violet-200 focus:border-violet-300 focus:ring" />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">المصدر</label>
            <select name="source" value={form.source} onChange={change}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none ring-violet-200 focus:border-violet-300 focus:ring">
              {SOURCE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">رابط الموقع أو اللوكيشن</label>
            <input name="website_or_location" value={form.website_or_location} onChange={change}
              placeholder="https://..."
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none ring-violet-200 focus:border-violet-300 focus:ring" dir="ltr" />
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose}
            className="rounded-xl border border-slate-200 px-4 py-1.5 text-sm font-semibold text-slate-600 hover:bg-slate-50">
            إلغاء
          </button>
          <button type="button" onClick={handleSave} disabled={saving || !form.store_name.trim() || !form.phone_number.trim()}
            className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            حفظ التعديلات
          </button>
        </div>
      </div>
    </div>
  )
}

export default function LeadManagement() {
  const { user } = useAuth()
  const fileInputRef = useRef(null)

  const [formData,      setFormData]      = useState(INITIAL_FORM)
  const [mediaFile,     setMediaFile]     = useState(null)
  const [mediaPreview,  setMediaPreview]  = useState('')
  const [leads,         setLeads]         = useState([])
  const [loadingList,   setLoadingList]   = useState(true)
  const [creating,      setCreating]      = useState(false)
  const [updatingId,    setUpdatingId]    = useState(null)
  const [error,         setError]         = useState('')
  const [success,       setSuccess]       = useState('')
  const [lightbox,      setLightbox]      = useState('')
  const [accountDialog, setAccountDialog] = useState(null)
  const [editLead,      setEditLead]      = useState(null)

  const username = user?.fullname || user?.username || 'Unknown'

  async function fetchLeads() {
    setLoadingList(true)
    setError('')
    try {
      const res = await getLeads()
      if (!res?.success) {
        setError(res?.error || 'تعذّر تحميل القائمة.')
        setLeads([])
      } else {
        setLeads(res.data || [])
      }
    } catch {
      setError('تعذّر الاتصال بالخادم. يرجى تسجيل الدخول والمحاولة مجدداً.')
      setLeads([])
    }
    setLoadingList(false)
  }

  useEffect(() => { void fetchLeads() }, [user?.id])

  useEffect(() => {
    return () => { if (mediaPreview) URL.revokeObjectURL(mediaPreview) }
  }, [mediaPreview])

  function handleFormChange(e) {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  function handleFileChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (mediaPreview) URL.revokeObjectURL(mediaPreview)
    setMediaFile(file)
    setMediaPreview(URL.createObjectURL(file))
  }

  function clearFile() {
    if (mediaPreview) URL.revokeObjectURL(mediaPreview)
    setMediaFile(null)
    setMediaPreview('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function handleCreateLead(e) {
    e.preventDefault()
    if (!formData.store_name.trim() || !formData.phone_number.trim()) {
      setError('يرجى إدخال اسم المتجر ورقم الهاتف.')
      return
    }

    setCreating(true)
    setError('')
    setSuccess('')

    const fd = new FormData()
    fd.append('store_name',          formData.store_name.trim())
    fd.append('phone_number',         formData.phone_number.trim())
    fd.append('source',               formData.source)
    fd.append('website_or_location',  formData.website_or_location.trim())
    fd.append('responsible_name',     formData.responsible_name.trim())
    fd.append('region',               formData.region.trim())
    if (user?.id) fd.append('assigned_to_id', String(user.id))
    if (mediaFile) fd.append('media_screenshot', mediaFile)

    const res = await createLead(fd)
    if (!res?.success) {
      setError(res?.error || 'فشل إضافة العميل المحتمل.')
    } else {
      setSuccess('تمت إضافة العميل المحتمل بنجاح.')
      setFormData(INITIAL_FORM)
      clearFile()
      await fetchLeads()
    }

    setCreating(false)
  }

  async function updateLead(leadId, patch) {
    setUpdatingId(leadId)
    setError('')
    setSuccess('')
    try {
      const res = await patchLead(leadId, patch)
      if (!res?.success) {
        setError(res?.error || 'فشل تحديث العميل المحتمل.')
      } else {
        setSuccess('تم التحديث.')
        await fetchLeads()
      }
    } catch {
      setError('تعذّر الاتصال بالخادم.')
    }
    setUpdatingId(null)
  }

  function handleOpenAccount(lead) {
    setAccountDialog(lead)
  }

  async function confirmOpenAccount(accountId) {
    if (!accountDialog) return
    await updateLead(accountDialog.id, { account_opened: true, account_id: accountId })
    setAccountDialog(null)
  }

  async function handleEditSave(leadId, patch) {
    await updateLead(leadId, patch)
    setEditLead(null)
  }

  return (
    <div className="space-y-5" dir="rtl">
      {lightbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setLightbox('')}
        >
          <img src={lightbox} alt="صورة الميديا" className="max-h-[90vh] max-w-[90vw] rounded-xl shadow-2xl" />
        </div>
      )}

      {accountDialog && (
        <AccountIdDialog
          onConfirm={confirmOpenAccount}
          onCancel={() => setAccountDialog(null)}
        />
      )}

      {editLead && (
        <EditLeadModal
          lead={editLead}
          onSave={patch => handleEditSave(editLead.id, patch)}
          onClose={() => setEditLead(null)}
        />
      )}

      <div className="rounded-2xl border border-amber-200 bg-gradient-to-l from-amber-50 to-white p-5 shadow-sm ring-1 ring-amber-100">
        <h1 className="text-xl font-black text-slate-900">جمع البيانات والمتابعة</h1>
        <p className="mt-1 text-sm text-slate-500">إدارة العملاء المحتملين ومتابعة دورة التحويل خطوة بخطوة.</p>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <Plus size={16} className="text-violet-600" />
          <h2 className="text-base font-bold text-slate-900">إضافة عميل محتمل</h2>
        </div>

        <form onSubmit={handleCreateLead} className="space-y-3">
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            <input
              name="store_name"
              value={formData.store_name}
              onChange={handleFormChange}
              placeholder="اسم المتجر *"
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none ring-violet-200 transition focus:border-violet-300 focus:ring"
            />
            <input
              name="phone_number"
              value={formData.phone_number}
              onChange={handleFormChange}
              placeholder="رقم الهاتف *"
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none ring-violet-200 transition focus:border-violet-300 focus:ring"
              dir="ltr"
            />
            <input
              name="responsible_name"
              value={formData.responsible_name}
              onChange={handleFormChange}
              placeholder="اسم المسؤول"
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none ring-violet-200 transition focus:border-violet-300 focus:ring"
            />
            <input
              name="region"
              value={formData.region}
              onChange={handleFormChange}
              placeholder="المنطقة"
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none ring-violet-200 transition focus:border-violet-300 focus:ring"
            />
          </div>

          <div className="grid gap-3 md:grid-cols-3">
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

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                <MapPin size={12} className="mr-1 inline" />
                رابط الموقع الجغرافي أو الموقع الإلكتروني
              </label>
              <input
                name="website_or_location"
                value={formData.website_or_location}
                onChange={handleFormChange}
                placeholder="https://maps.google.com/... أو رابط الموقع"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none ring-violet-200 transition focus:border-violet-300 focus:ring"
                dir="ltr"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                <Image size={12} className="mr-1 inline" />
                صورة صفحة الميديا (سكرين شوت)
              </label>
              {mediaPreview ? (
                <div className="flex items-center gap-3">
                  <img
                    src={mediaPreview}
                    alt="معاينة"
                    className="h-14 w-14 cursor-pointer rounded-xl border border-slate-200 object-cover shadow-sm"
                    onClick={() => setLightbox(mediaPreview)}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs text-slate-600">{mediaFile?.name}</p>
                    <button
                      type="button"
                      onClick={clearFile}
                      className="mt-0.5 flex items-center gap-1 text-xs text-rose-600 hover:text-rose-700"
                    >
                      <X size={11} /> حذف الصورة
                    </button>
                  </div>
                </div>
              ) : (
                <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-slate-300 px-3 py-2.5 text-sm text-slate-500 hover:border-violet-400 hover:text-violet-600 transition">
                  <Image size={15} />
                  اختر صورة من الجهاز
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                </label>
              )}
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={creating}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-5 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {creating ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
              إضافة
            </button>
          </div>
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
          <h2 className="text-base font-bold text-slate-900">العملاء المحتملون</h2>
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
                  <th className="px-3 py-2 font-semibold">المسؤول / المنطقة</th>
                  <th className="px-3 py-2 font-semibold">المصدر</th>
                  <th className="px-3 py-2 font-semibold">الروابط</th>
                  <th className="px-3 py-2 font-semibold">الحالة</th>
                  <th className="px-3 py-2 font-semibold">زيارة ميدانية</th>
                  <th className="px-3 py-2 font-semibold">الحساب</th>
                  <th className="px-3 py-2 font-semibold">الإجراءات</th>
                </tr>
              </thead>
              <tbody>
                {leads.map(lead => {
                  const busy     = updatingId === lead.id
                  const answered = lead.contact_status === 'answered'
                  const canVisit = answered && lead.requires_field_visit && !lead.field_visit_done
                  const canOpen  = answered && (!lead.requires_field_visit || lead.field_visit_done) && !lead.account_opened
                  return (
                    <tr key={lead.id} className="border-b border-slate-100 align-top">
                      <td className="px-3 py-3">
                        <p className="font-semibold text-slate-900">{lead.store_name}</p>
                        <p className="mt-0.5 text-xs text-slate-400">{formatDate(lead.created_at)}</p>
                      </td>
                      <td className="px-3 py-3 text-slate-700">
                        <a href={`tel:${lead.phone_number}`} className="inline-flex items-center gap-1 hover:text-violet-600">
                          <Phone size={13} />
                          {lead.phone_number}
                        </a>
                      </td>
                      <td className="px-3 py-3 text-xs text-slate-600">
                        {lead.responsible_name
                          ? <p className="font-medium text-slate-700">{lead.responsible_name}</p>
                          : <span className="text-slate-300">—</span>}
                        {lead.region
                          ? <p className="mt-0.5 text-slate-500">{lead.region}</p>
                          : null}
                      </td>
                      <td className="px-3 py-3 text-slate-600 text-xs">
                        {SOURCE_LABELS[lead.source] ?? lead.source ?? '-'}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex flex-col gap-1.5">
                          {lead.media_screenshot_url ? (
                            <button
                              type="button"
                              onClick={() => setLightbox(lead.media_screenshot_url)}
                              className="flex items-center gap-1 text-xs text-violet-600 hover:underline"
                            >
                              <Image size={12} />
                              صورة الميديا
                            </button>
                          ) : (
                            <span className="text-xs text-slate-300">لا صورة</span>
                          )}
                          {lead.website_or_location ? (
                            <a
                              href={lead.website_or_location}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 text-xs text-blue-600 hover:underline"
                            >
                              <MapPin size={12} />
                              موقع / لوكيشن
                              <ExternalLink size={10} />
                            </a>
                          ) : (
                            <span className="text-xs text-slate-300">لا رابط</span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <StatusBadge status={lead.contact_status} />
                      </td>
                      <td className="px-3 py-3 text-xs text-slate-600">
                        {lead.requires_field_visit
                          ? (lead.field_visit_done ? '✓ تمت' : 'مطلوبة')
                          : 'غير مطلوبة'}
                      </td>
                      <td className="px-3 py-3 text-xs">
                        {lead.account_opened ? (
                          <div>
                            <span className="font-semibold text-emerald-600">✓ تم الفتح</span>
                            {lead.account_id && (
                              <p className="mt-0.5 font-mono text-slate-500">#{lead.account_id}</p>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400">لم يتم</span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex flex-wrap gap-1.5">
                          <button type="button" disabled={busy}
                            onClick={() => updateLead(lead.id, { contact_status: 'answered' })}
                            className="rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-60">
                            تم الرد
                          </button>
                          <button type="button" disabled={busy}
                            onClick={() => updateLead(lead.id, { contact_status: 'no_answer' })}
                            className="rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-700 hover:bg-amber-100 disabled:opacity-60">
                            لم يرد
                          </button>
                          {answered && (
                            <button type="button" disabled={busy}
                              onClick={() => updateLead(lead.id, { requires_field_visit: !lead.requires_field_visit })}
                              className="rounded-lg border border-indigo-200 bg-indigo-50 px-2 py-1 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 disabled:opacity-60">
                              {lead.requires_field_visit ? 'إلغاء الزيارة' : 'زيارة ميدانية؟'}
                            </button>
                          )}
                          {canVisit && (
                            <button type="button" disabled={busy}
                              onClick={() => updateLead(lead.id, { field_visit_done: true })}
                              className="rounded-lg border border-cyan-200 bg-cyan-50 px-2 py-1 text-xs font-semibold text-cyan-700 hover:bg-cyan-100 disabled:opacity-60">
                              تمت الزيارة
                            </button>
                          )}
                          <button type="button" disabled={busy || !canOpen}
                            onClick={() => handleOpenAccount(lead)}
                            className="rounded-lg border border-violet-200 bg-violet-50 px-2 py-1 text-xs font-semibold text-violet-700 hover:bg-violet-100 disabled:cursor-not-allowed disabled:opacity-40">
                            فتح الحساب
                          </button>
                          <button type="button" disabled={busy}
                            onClick={() => setEditLead(lead)}
                            className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-60">
                            <Pencil size={12} className="inline" /> تعديل
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
