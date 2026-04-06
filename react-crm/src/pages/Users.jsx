import { useState, useEffect } from 'react'
import { Users as UsersIcon, Plus, Trash2, Edit2, X, Check, CheckCircle2, Circle } from 'lucide-react'
import { listUsers, addUser, updateUser, deleteUser, getInactiveRecoveryDailyStatus } from '../services/api'
import { useAuth } from '../contexts/AuthContext'
import { ROLES } from '../contexts/AuthContext'

const ROLE_OPTIONS = Object.entries(ROLES).map(([value, { label }]) => ({ value, label }))

const EMPTY_FORM = { username: '', fullname: '', password: '', role: 'active_manager' }

export default function Users() {
  const { user } = useAuth()
  const [users, setUsers]       = useState([])
  const [loading, setLoading]   = useState(true)
  /** username → هدف 50 اليوم (مسؤول استعادة) — للمدير التنفيذي */
  const [inactiveGoalByUser, setInactiveGoalByUser] = useState(() => ({}))
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing]   = useState(null)
  const [form, setForm]         = useState(EMPTY_FORM)
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState('')

  async function loadUsers() {
    setLoading(true)
    try {
      const res = await listUsers()
      setUsers(res.data || [])
      if (user?.role === 'executive') {
        const g = await getInactiveRecoveryDailyStatus()
        if (g?.success && Array.isArray(g.data)) {
          const m = {}
          for (const row of g.data) {
            if (row?.username) m[row.username] = !!row.daily_goal_met
          }
          setInactiveGoalByUser(m)
        }
      } else {
        setInactiveGoalByUser({})
      }
    } catch { /* ignore */ }
    setLoading(false)
  }

  useEffect(() => { loadUsers() }, [user?.role])

  function openAdd() { setEditing(null); setForm(EMPTY_FORM); setError(''); setShowForm(true) }
  function openEdit(u) {
    setEditing(u)
    setForm({ username: u.username, fullname: u.fullname, password: '', role: u.role })
    setError('')
    setShowForm(true)
  }

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      if (editing) {
        await updateUser({ id: editing.id, ...form })
      } else {
        if (!form.password) { setError('كلمة المرور مطلوبة'); setSaving(false); return }
        await addUser(form)
      }
      setShowForm(false)
      loadUsers()
    } catch (err) {
      setError(err?.response?.data?.error || 'فشل الحفظ')
    }
    setSaving(false)
  }

  async function handleDelete(u) {
    if (!confirm(`هل تريد حذف المستخدم "${u.fullname}"؟`)) return
    await deleteUser(u.id)
    loadUsers()
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <UsersIcon size={24} className="text-blue-600" />
            إدارة المستخدمين
          </h1>
          <p className="text-slate-500 text-sm mt-0.5">{users.length} مستخدم مسجل</p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold shadow-sm transition-colors"
        >
          <Plus size={16} />
          إضافة مستخدم
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        {loading ? (
          <div className="text-center py-12 text-slate-400">جارٍ التحميل...</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-xs font-semibold">
                <th className="text-right px-5 py-3">الاسم</th>
                <th className="text-right px-5 py-3">اسم المستخدم</th>
                <th className="text-right px-5 py-3">الصلاحية</th>
                {user?.role === 'executive' && (
                  <th className="text-right px-5 py-3 text-xs">هدف استعادة اليوم</th>
                )}
                <th className="text-right px-5 py-3">تاريخ الإنشاء</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} className="border-t border-slate-50 hover:bg-slate-50 transition-colors">
                  <td className="px-5 py-4 font-medium text-slate-800">{u.fullname}</td>
                  <td className="px-5 py-4 text-slate-500 font-mono text-xs">{u.username}</td>
                  <td className="px-5 py-4">
                    <span className="text-xs bg-blue-100 text-blue-700 px-2.5 py-1 rounded-full font-medium">
                      {ROLES[u.role]?.label ?? u.role}
                    </span>
                  </td>
                  {user?.role === 'executive' && (
                    <td className="px-5 py-4">
                      {u.role === 'inactive_manager' ? (
                        inactiveGoalByUser[u.username] ? (
                          <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700">
                            <CheckCircle2 size={16} className="shrink-0" />
                            تم
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                            <Circle size={16} className="shrink-0 text-slate-300" />
                            —
                          </span>
                        )
                      ) : (
                        <span className="text-slate-300 text-xs">—</span>
                      )}
                    </td>
                  )}
                  <td className="px-5 py-4 text-slate-400 text-xs">
                    {u.created_at ? new Date(u.created_at).toLocaleDateString('ar-SA') : '—'}
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2 justify-end">
                      <button onClick={() => openEdit(u)} className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-blue-600 transition-colors">
                        <Edit2 size={14} />
                      </button>
                      {u.id !== 1 && (
                        <button onClick={() => handleDelete(u)} className="w-8 h-8 rounded-lg hover:bg-red-50 flex items-center justify-center text-slate-400 hover:text-red-600 transition-colors">
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <h3 className="font-bold text-slate-800">{editing ? 'تعديل مستخدم' : 'إضافة مستخدم جديد'}</h3>
              <button onClick={() => setShowForm(false)} className="w-8 h-8 rounded-xl hover:bg-slate-100 flex items-center justify-center text-slate-400">
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleSave} className="p-5 space-y-4">
              {error && <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">{error}</div>}
              <Field label="الاسم الكامل" value={form.fullname} onChange={v => setForm(f => ({ ...f, fullname: v }))} required />
              <Field label="اسم المستخدم" value={form.username} onChange={v => setForm(f => ({ ...f, username: v }))} required />
              <Field label={editing ? 'كلمة مرور جديدة (اتركها فارغة للإبقاء)' : 'كلمة المرور'} value={form.password} onChange={v => setForm(f => ({ ...f, password: v }))} type="password" required={!editing} />
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">الصلاحية</label>
                <select
                  value={form.role}
                  onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800 text-sm bg-white"
                >
                  {ROLE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={saving} className="flex-1 flex items-center justify-center gap-2 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-bold rounded-xl transition-colors">
                  <Check size={16} />
                  {saving ? 'جارٍ الحفظ...' : 'حفظ'}
                </button>
                <button type="button" onClick={() => setShowForm(false)} className="px-5 py-3 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-xl font-medium">
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

function Field({ label, value, onChange, type = 'text', required }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1.5">{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        required={required}
        className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800 text-sm"
      />
    </div>
  )
}
