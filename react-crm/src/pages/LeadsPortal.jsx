import { useEffect, useState, useCallback } from 'react'
import { Loader2, Plus, Phone, UserCheck, LogIn, LogOut, Database } from 'lucide-react'
import { login as apiLogin, createLead, getLeads, patchLead, formatAuthError } from '../services/api'

const PORTAL_SESSION_KEY = 'nawras_leads_portal_session'
const PORTAL_ALLOWED_ROLES = ['data_collector', 'admin']

const INITIAL_FORM = {
  store_name: '',
  phone_number: '',
  source: 'social_media',
}

const SOURCE_OPTIONS = [
  { value: 'social_media', label: 'سوشال ميديا' },
  { value: 'field_visit', label: 'زيارة ميدانية' },
  { value: 'other', label: 'مصدر آخر' },
]

function formatDate(value) {
  if (!value) return '-'
  try {
    return new Date(value).toLocaleString('ar-IQ', { hour12: true })
  } catch {
    return value
  }
}

function readPortalUser() {
  try {
    const raw = localStorage.getItem(PORTAL_SESSION_KEY)
    if (!raw) return null
    const u = JSON.parse(raw)
    const roleRaw = typeof u?.role === 'string' ? u.role.trim().toLowerCase() : null
    if (!u || !roleRaw || !PORTAL_ALLOWED_ROLES.includes(roleRaw)) return null
    return { ...u, role: roleRaw }
  } catch {
    return null
  }
}

export default function LeadsPortal() {
  const [portalUser, setPortalUser] = useState(() => readPortalUser())
  const [authForm, setAuthForm] = useState({ username: '', password: '' })
  const [authLoading, setAuthLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [formData, setFormData] = useState(INITIAL_FORM)
  const [leads, setLeads] = useState([])
  const [loadingList, setLoadingList] = useState(false)
  const [creating, setCreating] = useState(false)
  const [updatingLeadId, setUpdatingLeadId] = useState(null)

  const isSignedIn = Boolean(portalUser?.id)

  const fetchLeads = useCallback(async () => {
    if (!isSignedIn) {
      setLeads([])
      return
    }
    setLoadingList(true)
    setError('')
    const res = await getLeads()
    if (!res?.success) {
      setError(res?.error || 'تعذّر تحميل قائمة العملاء المحتملين.')
      setLeads([])
    } else {
      setLeads(res.data || [])
    }
    setLoadingList(false)
  }, [isSignedIn])

  useEffect(() => {
    if (!isSignedIn) return
    void fetchLeads()
  }, [isSignedIn, fetchLeads])

  function handleAuthInputChange(event) {
    const { name, value } = event.target
    setAuthForm(prev => ({ ...prev, [name]: value }))
  }

  function handleFormChange(event) {
    const { name, value } = event.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  async function handlePortalSignIn(event) {
    event.preventDefault()
    if (!authForm.username.trim() || !authForm.password) {
      setError('أدخل اسم المستخدم وكلمة المرور.')
      return
    }

    setAuthLoading(true)
    setError('')
    setSuccess('')

    try {
      const res = await apiLogin(authForm.username.trim(), authForm.password)
      if (!res?.success || !res?.user) {
        setError(res?.error || 'بيانات الدخول غير صحيحة.')
        setAuthLoading(false)
        return
      }
      const role = String(res.user.role || '').trim().toLowerCase()
      if (!PORTAL_ALLOWED_ROLES.includes(role)) {
        setError('هذه البوّابة مخصّصة لجامعي البيانات أو مدير النظام فقط.')
        setAuthLoading(false)
        return
      }
      const normalized = { ...res.user, role }
      localStorage.setItem(PORTAL_SESSION_KEY, JSON.stringify(normalized))
      setPortalUser(normalized)
      setAuthForm({ username: authForm.username.trim(), password: '' })
      setSuccess('تم تسجيل الدخول بنجاح.')
    } catch (err) {
      setError(formatAuthError(err))
    }
    setAuthLoading(false)
  }

  function handlePortalSignOut() {
    localStorage.removeItem(PORTAL_SESSION_KEY)
    setPortalUser(null)
    setLeads([])
    setError('')
    setSuccess('تم تسجيل الخروج من بوّابة جمع البيانات.')
  }

  async function handleCreateLead(event) {
    event.preventDefault()
    if (!isSignedIn) return
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
      assigned_to_id: portalUser?.id || null,
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
    if (!isSignedIn) return
    setUpdatingLeadId(leadId)
    setError('')
    setSuccess('')
    const res = await patchLead(leadId, patch)
    if (!res?.success) {
      setError(res?.error || 'فشل تحديث العميل المحتمل.')
    } else {
      setSuccess('تم تحديث حالة العميل المحتمل.')
      await fetchLeads()
    }
    setUpdatingLeadId(null)
  }

  return (
    <div dir="rtl" className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-amber-50 px-4 py-8">
      <div className="mx-auto max-w-5xl space-y-5">
        <header className="rounded-2xl border border-amber-200/70 bg-gradient-to-l from-amber-50 to-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-700">
              <Database size={20} />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl font-black text-slate-900">بوّابة جمع البيانات والمتابعة</h1>
              <p className="mt-0.5 text-xs text-slate-500">
                جلسة دخول مستقلة لفريق جمع البيانات — منفصلة عن واجهة CRM الأساسية.
              </p>
            </div>
          </div>
        </header>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 text-base font-bold text-slate-900">
              <UserCheck size={16} className="text-violet-600" />
              جلسة جامع البيانات
            </h2>
            {isSignedIn ? (
              <button
                type="button"
                onClick={handlePortalSignOut}
                className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100"
              >
                <LogOut size={13} />
                تسجيل الخروج
              </button>
            ) : null}
          </div>

          {isSignedIn ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
              الجلسة نشطة: <strong>{portalUser.fullname || portalUser.username}</strong>
              <span className="mx-1 text-emerald-700/70">·</span>
              الدور: {portalUser.role === 'admin' ? 'مدير النظام' : 'جامع بيانات'}
            </div>
          ) : (
            <form onSubmit={handlePortalSignIn} className="grid gap-3 md:grid-cols-3">
              <input
                type="text"
                name="username"
                value={authForm.username}
                onChange={handleAuthInputChange}
                placeholder="اسم المستخدم"
                autoComplete="username"
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none ring-violet-200 transition focus:border-violet-300 focus:ring"
              />
              <input
                type="password"
                name="password"
                value={authForm.password}
                onChange={handleAuthInputChange}
                placeholder="كلمة المرور"
                autoComplete="current-password"
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none ring-violet-200 transition focus:border-violet-300 focus:ring"
              />
              <button
                type="submit"
                disabled={authLoading}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {authLoading ? <Loader2 size={15} className="animate-spin" /> : <LogIn size={15} />}
                تسجيل دخول
              </button>
            </form>
          )}
        </section>

        {(error || success) && (
          <div
            className={`rounded-xl border px-4 py-2 text-sm ${
              error
                ? 'border-rose-200 bg-rose-50 text-rose-700'
                : 'border-emerald-200 bg-emerald-50 text-emerald-700'
            }`}
          >
            {error || success}
          </div>
        )}

        {!isSignedIn ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-10 text-center text-sm text-slate-500">
            سجّل الدخول من النموذج أعلاه للوصول إلى نموذج جمع البيانات وقائمة العملاء المحتملين.
          </div>
        ) : (
          <>
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
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
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
                        const canOpenAccount =
                          answered && (!lead.requires_field_visit || lead.field_visit_done) && !lead.account_opened
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
                              {lead.requires_field_visit
                                ? lead.field_visit_done
                                  ? 'تمت الزيارة'
                                  : 'مطلوبة'
                                : 'غير مطلوبة'}
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
                                  تم الرد
                                </button>
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() => updateLead(lead.id, { contact_status: 'no_answer' })}
                                  className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 hover:bg-amber-100 disabled:opacity-60"
                                >
                                  لم يرد
                                </button>

                                {answered && (
                                  <button
                                    type="button"
                                    disabled={busy}
                                    onClick={() =>
                                      updateLead(lead.id, { requires_field_visit: !lead.requires_field_visit })
                                    }
                                    className="rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 disabled:opacity-60"
                                  >
                                    {lead.requires_field_visit ? 'إلغاء الزيارة الميدانية' : 'يحتاج زيارة ميدانية؟'}
                                  </button>
                                )}

                                {canMarkVisitDone && (
                                  <button
                                    type="button"
                                    disabled={busy}
                                    onClick={() => updateLead(lead.id, { field_visit_done: true })}
                                    className="rounded-lg border border-cyan-200 bg-cyan-50 px-2.5 py-1 text-xs font-semibold text-cyan-700 hover:bg-cyan-100 disabled:opacity-60"
                                  >
                                    تمت الزيارة
                                  </button>
                                )}

                                <button
                                  type="button"
                                  disabled={busy || !canOpenAccount}
                                  onClick={() => updateLead(lead.id, { account_opened: true })}
                                  className="rounded-lg border border-violet-200 bg-violet-50 px-2.5 py-1 text-xs font-semibold text-violet-700 hover:bg-violet-100 disabled:cursor-not-allowed disabled:opacity-40"
                                >
                                  فتح الحساب
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
          </>
        )}

        <footer className="pt-2 text-center text-[11px] text-slate-400">
          بوّابة مستقلة — لا تؤثر على واجهة CRM الأساسية.
        </footer>
      </div>
    </div>
  )
}
