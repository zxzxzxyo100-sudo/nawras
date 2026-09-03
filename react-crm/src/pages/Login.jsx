import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { formatAuthError } from '../services/api'
import { Eye, EyeOff } from 'lucide-react'
import logo from '../assets/images/logo.png'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(email, password)
      navigate('/')
    } catch (err) {
      setError(formatAuthError(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div dir="ltr" className="min-h-screen flex bg-white">
      {/* لوحة التعريف — يسار الشاشة */}
      <div
        dir="rtl"
        className="hidden lg:flex flex-col justify-center flex-1 px-16 relative overflow-hidden"
        style={{ background: 'linear-gradient(160deg, #ecfaf6 0%, #e4f5ee 55%, #dcf0e7 100%)' }}
      >
        <div className="absolute -top-24 -start-24 w-80 h-80 rounded-full bg-teal-400/10 blur-3xl" aria-hidden />
        <div className="absolute -bottom-28 -end-16 w-96 h-96 rounded-full bg-emerald-400/10 blur-3xl" aria-hidden />

        <div className="relative z-10 max-w-md">
          <img src={logo} alt="شعار النورس" className="h-14 w-auto object-contain mb-10" />
          <h1 className="text-4xl xl:text-5xl font-black text-slate-900 leading-tight mb-4">
            مرحباً <span className="text-teal-600">بعودتك.</span>
          </h1>
          <p className="text-slate-500 text-base leading-relaxed">
            سجّل دخولك لمتابعة العمل على نظام النورس لإدارة علاقات المتاجر.
          </p>
        </div>
      </div>

      {/* نموذج الدخول — يمين الشاشة */}
      <div dir="rtl" className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="lg:hidden text-center mb-8">
            <img src={logo} alt="شعار النورس" className="h-12 w-auto object-contain mx-auto mb-3" />
            <h1 className="text-xl font-black text-slate-900">نظام النورس</h1>
          </div>

          <h2 className="text-2xl font-black text-slate-900 mb-1">تسجيل الدخول</h2>
          <p className="text-slate-400 text-sm mb-7">أدخل بياناتك للوصول إلى مساحة عملك.</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1.5">البريد الإلكتروني</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                dir="ltr"
                autoComplete="email"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-400 focus:bg-white text-slate-800 text-left transition-colors"
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1.5">كلمة المرور</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  dir="ltr"
                  autoComplete="current-password"
                  className="w-full px-4 py-3 pe-11 rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-400 focus:bg-white text-slate-800 text-left transition-colors"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(s => !s)}
                  className="absolute inset-y-0 end-3 flex items-center text-slate-400 hover:text-slate-600"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-100 text-red-600 text-sm text-center">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-teal-700 hover:bg-teal-800 disabled:bg-teal-400 text-white font-bold rounded-xl transition-colors duration-200 mt-2"
            >
              {loading ? 'جارٍ الدخول...' : 'تسجيل الدخول'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
