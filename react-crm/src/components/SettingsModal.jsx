import { useState } from 'react'
import { X, Moon, Sun, Lock, Loader2, Check } from 'lucide-react'
import { useTheme } from '../contexts/ThemeContext'
import { changePassword } from '../services/api'

export default function SettingsModal({ onClose }) {
  const { isDark, toggleTheme } = useTheme()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSuccess(false)
    if (newPassword.length < 6) {
      setError('كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('كلمة المرور الجديدة وتأكيدها غير متطابقين')
      return
    }
    setSaving(true)
    try {
      const res = await changePassword(currentPassword, newPassword)
      if (res?.success) {
        setSuccess(true)
        setCurrentPassword('')
        setNewPassword('')
        setConfirmPassword('')
      } else {
        setError(res?.error || 'تعذّر تغيير كلمة المرور')
      }
    } catch (err) {
      setError(err?.response?.data?.error || 'تعذّر تغيير كلمة المرور')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative z-10 w-full max-w-sm rounded-2xl border border-slate-200 bg-white dark:bg-slate-900 dark:border-slate-700 shadow-[0_24px_60px_-12px_rgba(15,23,42,0.35)]">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800">
          <p className="text-sm font-black text-slate-800 dark:text-slate-100">الإعدادات</p>
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X size={15} />
          </button>
        </div>

        <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800">
          <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-2">المظهر</p>
          <button
            type="button"
            onClick={toggleTheme}
            className="w-full flex items-center justify-between rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            <span className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-200">
              {isDark ? <Moon size={15} /> : <Sun size={15} />}
              الوضع الداكن
            </span>
            <span
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                isDark ? 'bg-violet-600' : 'bg-slate-300'
              }`}
            >
              <span
                className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                  isDark ? '-translate-x-4.5' : '-translate-x-1'
                }`}
                style={{ transform: isDark ? 'translateX(-1.125rem)' : 'translateX(-0.25rem)' }}
              />
            </span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-4 py-3 space-y-2.5">
          <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            <Lock size={12} />
            تغيير كلمة المرور
          </p>
          <input
            type="password"
            placeholder="كلمة المرور الحالية"
            value={currentPassword}
            onChange={e => setCurrentPassword(e.target.value)}
            required
            className="w-full rounded-lg border border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 px-3 py-2 text-xs outline-none focus:border-violet-400"
          />
          <input
            type="password"
            placeholder="كلمة المرور الجديدة"
            value={newPassword}
            onChange={e => setNewPassword(e.target.value)}
            required
            className="w-full rounded-lg border border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 px-3 py-2 text-xs outline-none focus:border-violet-400"
          />
          <input
            type="password"
            placeholder="تأكيد كلمة المرور الجديدة"
            value={confirmPassword}
            onChange={e => setConfirmPassword(e.target.value)}
            required
            className="w-full rounded-lg border border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 px-3 py-2 text-xs outline-none focus:border-violet-400"
          />

          {error && <p className="text-[11px] font-semibold text-red-600">{error}</p>}
          {success && (
            <p className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600">
              <Check size={12} /> تم تغيير كلمة المرور بنجاح
            </p>
          )}

          <button
            type="submit"
            disabled={saving}
            className="w-full flex items-center justify-center gap-1.5 rounded-lg bg-violet-600 hover:bg-violet-700 disabled:opacity-60 text-white text-xs font-bold py-2.5 transition-colors"
          >
            {saving && <Loader2 size={13} className="animate-spin" />}
            حفظ كلمة المرور
          </button>
        </form>
      </div>
    </div>
  )
}
