import { useMemo } from 'react'
import { Navigate } from 'react-router-dom'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts'
import { Phone, Package, Store, Truck, ArrowUpRight, MoreHorizontal } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

/** أرقام عربية شرقية للعرض */
function arNum(n) {
  return Number(n).toLocaleString('ar-EG')
}

const MOCK_CHART = [
  { label: 'أبريل', teal: 420, purple: 380 },
  { label: 'مايو', teal: 510, purple: 440 },
  { label: 'يونيو', teal: 480, purple: 520 },
  { label: 'يوليو', teal: 590, purple: 510 },
  { label: 'أغسطس', teal: 620, purple: 580 },
  { label: 'سبتمبر', teal: 540, purple: 600 },
]

const MOCK_TABLE = [
  { id: 'SH-10293', dest: 'الرياض', status: 'قيد الشحن', qty: 124 },
  { id: 'SH-10294', dest: 'جدة', status: 'تم التسليم', qty: 88 },
  { id: 'SH-10295', dest: 'الدمام', status: 'بانتظار الاستلام', qty: 56 },
  { id: 'SH-10296', dest: 'مكة', status: 'قيد الشحن', qty: 201 },
]

function StatPill({ icon: Icon, value, label }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col items-center gap-1 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-center backdrop-blur-sm sm:flex-row sm:items-center sm:gap-4 sm:text-right">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/15 bg-white/10">
        <Icon size={22} className="text-white/95" strokeWidth={2} />
      </div>
      <div className="min-w-0">
        <p className="text-3xl font-black tabular-nums text-white sm:text-4xl">{value}</p>
        <p className="mt-0.5 text-[11px] font-semibold leading-tight text-violet-200/95">{label}</p>
      </div>
    </div>
  )
}

function EdgeCard({ className, glow, children }) {
  return (
    <div
      className={`relative overflow-hidden rounded-2xl border p-5 shadow-xl ${className}`}
      style={glow ? { boxShadow: glow } : undefined}
    >
      <span
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-l from-transparent via-white/50 to-transparent"
        aria-hidden
      />
      {children}
    </div>
  )
}

export default function LogisticsAnalytics() {
  const { can } = useAuth()

  const chartData = useMemo(() => MOCK_CHART, [])

  if (!can('dashboard')) {
    return <Navigate to="/" replace />
  }

  return (
    <div
      className="min-h-screen bg-gradient-to-b from-slate-100 via-violet-50/40 to-slate-100 pb-16"
      style={{ fontFamily: "'Cairo', sans-serif" }}
    >
      {/* شريط علوي — بنفسجي غامق + إحصائيات بيضاء */}
      <header className="relative overflow-hidden border-b border-violet-950/30 bg-gradient-to-l from-[#1e0a3c] via-[#2d1250] to-[#1a082f] shadow-[0_20px_50px_-20px_rgba(45,18,80,0.65)]">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: 'repeating-linear-gradient(90deg, #fff 0px, #fff 1px, transparent 1px, transparent 10px)',
          }}
        />
        <div className="relative mx-auto max-w-[1600px] px-4 py-8 md:px-8 lg:py-10">
          <div className="mb-8 flex flex-col gap-2 text-right">
            <p className="text-[11px] font-bold uppercase tracking-[0.35em] text-violet-300/80">Logistics</p>
            <h1 className="text-2xl font-black text-white md:text-3xl">لوحة تحليلات الشحن والتوزيع</h1>
            <p className="text-sm font-medium text-violet-200/85">مؤشرات تشغيلية — عرض تجريبي للواجهة التنفيذية</p>
          </div>

          <div className="flex flex-col gap-4 lg:flex-row lg:items-stretch lg:justify-between lg:gap-6">
            <div className="flex min-w-0 flex-[2] flex-col gap-3 sm:flex-row sm:gap-3">
              <StatPill icon={Package} value={arNum(12000)} label="إجمالي الطرود المعالجة" />
              <StatPill icon={Phone} value={arNum(250)} label="مكالمات التتبع اليوم" />
            </div>
            <div className="flex flex-[1] items-center justify-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur-md lg:justify-end">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-white/15 bg-white/10">
                <Store size={24} className="text-white" strokeWidth={2} />
              </div>
              <div className="text-right">
                <p className="text-lg font-black text-white">مراكز التوزيع</p>
                <p className="text-xs font-semibold text-violet-200/90">١٤ موقعاً نشطاً</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1600px] px-4 py-8 md:px-8">
        {/* بطاقات ملونة — ترتيب يطابق الواجهة المرجعية (يسار→يمين) */}
        <div dir="ltr" className="mb-10 grid grid-cols-1 gap-5 md:grid-cols-3">
          <EdgeCard
            className="border-emerald-400/25 bg-gradient-to-br from-emerald-600 to-emerald-800 text-white"
            glow="0 0 40px -10px rgba(16, 185, 129, 0.45), inset 0 1px 0 rgba(255,255,255,0.15)"
          >
            <div dir="rtl" className="relative z-10 text-right">
              <div className="mb-4 flex items-center justify-between gap-2">
                <span className="rounded-lg bg-white/15 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-emerald-100">
                  نشط
                </span>
                <Truck size={22} className="text-white/90" strokeWidth={2} />
              </div>
              <p className="text-3xl font-black tabular-nums md:text-4xl">١٬٦٩٥</p>
              <p className="mt-1 text-sm font-bold text-emerald-100/95">طرد نشط</p>
              <div className="mt-5 h-12">
                <svg viewBox="0 0 120 40" className="h-full w-full" preserveAspectRatio="none" aria-hidden>
                  <defs>
                    <linearGradient id="lg" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="rgba(255,255,255,0.35)" />
                      <stop offset="100%" stopColor="rgba(255,255,255,0)" />
                    </linearGradient>
                  </defs>
                  <path
                    d="M0,32 L20,28 L40,30 L55,18 L70,22 L85,12 L100,16 L120,8 L120,40 L0,40 Z"
                    fill="url(#lg)"
                  />
                  <path
                    d="M0,32 L20,28 L40,30 L55,18 L70,22 L85,12 L100,16 L120,8"
                    fill="none"
                    stroke="rgba(255,255,255,0.85)"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              </div>
            </div>
          </EdgeCard>

          <EdgeCard
            className="border-orange-400/30 bg-gradient-to-br from-orange-500 to-amber-700 text-white"
            glow="0 0 48px -8px rgba(251, 146, 60, 0.5), inset 0 1px 0 rgba(255,255,255,0.12)"
          >
            <div dir="rtl" className="text-right">
              <div className="mb-4 flex items-center justify-between">
                <ArrowUpRight size={22} className="text-white/90" />
                <span className="text-[10px] font-black text-orange-100/90">تنبيه</span>
              </div>
              <p className="text-3xl font-black tabular-nums md:text-4xl">١٬٢٢٨</p>
              <p className="mt-1 text-sm font-bold text-orange-50">غير نشط</p>
              <p className="mt-4 text-xs font-medium leading-relaxed text-orange-100/90">
                يتطلب متابعة أو إعادة جدولة ضمن نافذة ٤٨ ساعة.
              </p>
            </div>
          </EdgeCard>

          <EdgeCard className="border-violet-400/25 bg-gradient-to-br from-violet-700 via-violet-800 to-[#1e0a3c] text-white">
            <div dir="rtl" className="text-right">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex gap-1">
                  <button
                    type="button"
                    className="rounded-lg border border-white/15 bg-white/10 p-2 text-white transition hover:bg-white/20"
                    aria-label="إجراءات"
                  >
                    <MoreHorizontal size={18} />
                  </button>
                  <button
                    type="button"
                    className="rounded-lg border border-white/15 bg-white/10 p-2 text-white transition hover:bg-white/20"
                    aria-label="تصدير"
                  >
                    <Package size={18} />
                  </button>
                </div>
                <span className="text-[10px] font-black text-violet-200">عمليات سريعة</span>
              </div>
              <p className="text-lg font-black">تسوية الدُفعات</p>
              <p className="mt-2 text-sm font-medium text-violet-200/90">٣٢ طلباً بانتظار المراجعة التنفيذية</p>
              <div className="mt-5 flex flex-wrap gap-2">
                <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-bold">موافقة</span>
                <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-bold">تفاصيل</span>
              </div>
            </div>
          </EdgeCard>
        </div>

        {/* رسم بياني + جدول */}
        <div className="overflow-hidden rounded-2xl border border-violet-200/60 bg-white shadow-[0_24px_60px_-28px_rgba(76,29,149,0.2)]">
          <div className="border-b border-violet-100 bg-gradient-to-l from-violet-50 to-white px-5 py-4 text-right">
            <h2 className="text-base font-black text-violet-950">أداء الشحن — اتجاهات شهرية</h2>
            <p className="text-xs font-semibold text-slate-500">خطوط: أحجام الشحن (فيروزي) مقابل SLA الداخلي (بنفسجي)</p>
          </div>
          <div className="bg-[#0f0f18] px-2 py-4 md:px-4">
            <div className="h-[280px] w-full min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 12, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.12)" />
                  <XAxis
                    dataKey="label"
                    tick={{ fill: 'rgba(226,232,240,0.75)', fontSize: 11 }}
                    axisLine={{ stroke: 'rgba(148,163,184,0.25)' }}
                  />
                  <YAxis
                    tick={{ fill: 'rgba(226,232,240,0.65)', fontSize: 11 }}
                    axisLine={{ stroke: 'rgba(148,163,184,0.25)' }}
                  />
                  <Tooltip
                    contentStyle={{
                      background: 'rgba(30,10,60,0.95)',
                      border: '1px solid rgba(167,139,250,0.35)',
                      borderRadius: 12,
                      fontFamily: 'Cairo, sans-serif',
                    }}
                    labelStyle={{ color: '#e9d5ff' }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                  <Line
                    type="monotone"
                    dataKey="teal"
                    name="حجم الشحن"
                    stroke="#2dd4bf"
                    strokeWidth={2.5}
                    dot={false}
                    activeDot={{ r: 5, fill: '#2dd4bf' }}
                  />
                  <Line
                    type="monotone"
                    dataKey="purple"
                    name="مؤشر SLA"
                    stroke="#a78bfa"
                    strokeWidth={2.5}
                    dot={false}
                    activeDot={{ r: 5, fill: '#a78bfa' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="overflow-x-auto border-t border-violet-100">
            <table className="w-full min-w-[640px] border-collapse text-right text-sm">
              <thead>
                <tr className="border-b border-violet-100 bg-violet-50/80">
                  <th className="px-4 py-3 font-black text-violet-900">رقم الشحنة</th>
                  <th className="px-4 py-3 font-black text-violet-900">الوجهة</th>
                  <th className="px-4 py-3 font-black text-violet-900">الحالة</th>
                  <th className="px-4 py-3 font-black text-violet-900">القطع</th>
                </tr>
              </thead>
              <tbody>
                {MOCK_TABLE.map(row => (
                  <tr key={row.id} className="border-b border-slate-100/90 transition hover:bg-violet-50/40">
                    <td className="px-4 py-3 font-mono font-semibold text-slate-800">{row.id}</td>
                    <td className="px-4 py-3 font-medium text-slate-700">{row.dest}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex rounded-full bg-violet-100 px-2.5 py-0.5 text-xs font-bold text-violet-900">
                        {row.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 tabular-nums font-bold text-slate-800">{arNum(row.qty)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
