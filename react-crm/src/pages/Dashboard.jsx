import { useNavigate } from 'react-router-dom'
import {
  Store, Package, RefreshCw, AlertCircle, TrendingUp, Flame,
  Snowflake, Phone, ArrowUpRight, Baby, Activity,
} from 'lucide-react'
import { useStores } from '../contexts/StoresContext'
import { useAuth } from '../contexts/AuthContext'

// ─── مؤشر توزيع الفئات ───────────────────────────────────────────────────────
function DistributionBar({ counts }) {
  const total = (counts.incubating || 0) + (counts.active_shipping || 0) + (counts.hot_inactive || 0) + (counts.cold_inactive || 0)
  if (!total) return null
  const pct = v => ((v / total) * 100).toFixed(1)
  const segs = [
    { key: 'incubating',      color: 'bg-purple-500', label: 'جديدة',      v: counts.incubating      || 0 },
    { key: 'active_shipping', color: 'bg-emerald-500',label: 'نشطة',       v: counts.active_shipping || 0 },
    { key: 'hot_inactive',    color: 'bg-amber-500',  label: 'ساخنة',      v: counts.hot_inactive    || 0 },
    { key: 'cold_inactive',   color: 'bg-red-500',    label: 'باردة',      v: counts.cold_inactive   || 0 },
  ]
  return (
    <div className="space-y-2">
      <div className="flex h-2.5 rounded-full overflow-hidden gap-0.5">
        {segs.map(s => (
          <div
            key={s.key}
            className={`${s.color} transition-all duration-700`}
            style={{ width: `${pct(s.v)}%` }}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {segs.map(s => (
          <div key={s.key} className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${s.color} flex-shrink-0`} />
            <span className="text-xs text-slate-400">{s.label}</span>
            <span className="text-xs font-bold text-slate-300">{pct(s.v)}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── بطاقة KPI ───────────────────────────────────────────────────────────────
function KpiCard({ title, value, sub, icon: Icon, gradient, ring, onClick }) {
  return (
    <button
      onClick={onClick}
      className="group relative bg-white rounded-2xl p-4 lg:p-5 shadow-sm border border-slate-100 hover:shadow-lg hover:-translate-y-0.5 active:scale-95 transition-all duration-200 text-right w-full overflow-hidden"
    >
      {/* accent line top */}
      <div className={`absolute top-0 inset-x-0 h-0.5 ${gradient}`} />
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-slate-500 text-xs font-medium mb-2 leading-tight">{title}</p>
          <p className="text-2xl lg:text-3xl font-black text-slate-800 leading-none">{(value || 0).toLocaleString('ar-SA')}</p>
          {sub && <p className="text-slate-400 text-xs mt-1.5 leading-tight">{sub}</p>}
        </div>
        <div className={`w-10 h-10 lg:w-11 lg:h-11 rounded-2xl ${ring} flex items-center justify-center flex-shrink-0`}>
          <Icon size={18} className="text-white" />
        </div>
      </div>
      <div className="absolute bottom-3 left-3 opacity-0 group-hover:opacity-100 transition-opacity">
        <ArrowUpRight size={14} className="text-slate-300" />
      </div>
    </button>
  )
}

// ─── صف إحصائية ─────────────────────────────────────────────────────────────
function StatRow({ label, value, color, icon: Icon }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-slate-50 last:border-0">
      <div className="flex items-center gap-2.5">
        {Icon && (
          <div className={`w-7 h-7 rounded-lg ${color.bg} flex items-center justify-center flex-shrink-0`}>
            <Icon size={13} className={color.icon} />
          </div>
        )}
        <span className="text-slate-500 text-xs lg:text-sm">{label}</span>
      </div>
      <span className={`font-black text-base lg:text-lg ${color.text}`}>{value}</span>
    </div>
  )
}

export default function Dashboard() {
  const { counts, stores, allStores, callLogs, loading, error, lastLoaded, reload } = useStores()
  const { user } = useAuth()
  const navigate = useNavigate()

  const totalShipments = allStores.reduce((sum, s) => sum + (parseInt(s.total_shipments) || 0), 0)
  const today          = new Date().toISOString().split('T')[0]
  const calledToday    = Object.values(callLogs).filter(log =>
    Object.values(log || {}).some(e => e?.date?.startsWith(today))
  ).length
  const pendingNewCalls = (stores.incubating || []).filter(s => !callLogs[s.id]?.day0).length
  const recentNew = [...(stores.incubating || [])]
    .sort((a, b) => new Date(b.registered_at || 0) - new Date(a.registered_at || 0))
    .slice(0, 6)

  // نسبة النشاط
  const activeRate = counts.total
    ? Math.round(((counts.active_shipping || 0) / counts.total) * 100)
    : 0

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-64 gap-3 text-slate-400">
      <div className="w-10 h-10 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
      <p className="text-sm">جارٍ تحميل البيانات...</p>
    </div>
  )

  if (error) return (
    <div className="flex flex-col items-center justify-center h-64 text-red-500 gap-3">
      <AlertCircle size={40} />
      <p className="font-medium">{error}</p>
      <button onClick={reload} className="px-4 py-2 bg-red-600 text-white rounded-xl text-sm font-medium hover:bg-red-700">
        إعادة المحاولة
      </button>
    </div>
  )

  return (
    <div className="space-y-5 lg:space-y-6">

      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="hidden lg:block text-2xl font-black text-slate-800 tracking-tight">لوحة التحكم</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            مرحباً <span className="font-semibold text-slate-700">{user?.fullname}</span>
            {lastLoaded && (
              <span className="text-slate-400 mr-2">• {lastLoaded.toLocaleTimeString('ar-SA')}</span>
            )}
          </p>
        </div>
        <button
          onClick={reload}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors shadow-sm disabled:opacity-50"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          <span className="hidden sm:inline">تحديث</span>
        </button>
      </div>

      {/* ── Hero Banner ────────────────────────────────────────── */}
      <div className="relative bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-3xl p-5 lg:p-7 shadow-xl text-white overflow-hidden">
        {/* decorative circles */}
        <div className="absolute -top-8 -left-8 w-40 h-40 bg-blue-500/10 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -bottom-10 -right-6 w-52 h-52 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <p className="text-slate-400 text-xs font-medium uppercase tracking-widest mb-2">إجمالي المتاجر المسجّلة</p>
            <p className="text-5xl lg:text-6xl font-black tracking-tight leading-none">
              {(counts.total || 0).toLocaleString('ar-SA')}
            </p>
            <div className="flex items-center gap-2 mt-3">
              <span className="text-xs bg-emerald-500/20 text-emerald-300 px-2.5 py-1 rounded-full font-medium border border-emerald-500/20">
                {activeRate}% نسبة النشاط
              </span>
            </div>
          </div>
          <div className="flex-shrink-0">
            <div className="w-14 h-14 lg:w-16 lg:h-16 rounded-2xl bg-white/10 backdrop-blur flex items-center justify-center border border-white/10">
              <Package size={26} className="text-white" />
            </div>
          </div>
        </div>

        <div className="relative mt-5">
          <DistributionBar counts={counts} />
        </div>
      </div>

      {/* ── KPI Cards ──────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
        <KpiCard
          title="متاجر جديدة"
          value={counts.incubating}
          sub={pendingNewCalls > 0 ? `${pendingNewCalls} تحتاج مكالمة` : 'لا توجد مهام'}
          icon={Baby}
          gradient="bg-gradient-to-r from-purple-500 to-violet-500"
          ring="bg-gradient-to-br from-purple-500 to-violet-600"
          onClick={() => navigate('/new')}
        />
        <KpiCard
          title="نشط يشحن"
          value={counts.active_shipping}
          sub="شحن خلال آخر 14 يوم"
          icon={TrendingUp}
          gradient="bg-gradient-to-r from-emerald-500 to-green-500"
          ring="bg-gradient-to-br from-emerald-500 to-green-600"
          onClick={() => navigate('/active')}
        />
        <KpiCard
          title="غير نشط ساخن"
          value={counts.hot_inactive}
          sub="انقطع 15 – 60 يوم"
          icon={Flame}
          gradient="bg-gradient-to-r from-amber-500 to-orange-500"
          ring="bg-gradient-to-br from-amber-500 to-orange-500"
          onClick={() => navigate('/hot-inactive')}
        />
        <KpiCard
          title="غير نشط بارد"
          value={counts.cold_inactive}
          sub="أكثر من 60 يوم"
          icon={Snowflake}
          gradient="bg-gradient-to-r from-red-500 to-rose-500"
          ring="bg-gradient-to-br from-red-500 to-rose-500"
          onClick={() => navigate('/cold-inactive')}
        />
      </div>

      {/* ── Bottom Row ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-5">

        {/* أحدث المتاجر */}
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-50">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-purple-50 flex items-center justify-center">
                <Store size={15} className="text-purple-600" />
              </div>
              <h2 className="font-bold text-slate-800 text-sm">أحدث المتاجر المسجلة</h2>
            </div>
            <button
              onClick={() => navigate('/new')}
              className="flex items-center gap-1 text-blue-600 text-xs font-medium hover:text-blue-700 transition-colors"
            >
              عرض الكل
              <ArrowUpRight size={12} />
            </button>
          </div>
          {recentNew.length === 0 ? (
            <p className="text-slate-400 text-sm text-center py-10">لا توجد متاجر جديدة</p>
          ) : (
            <div>
              {recentNew.map((s, i) => {
                const hours = s.registered_at
                  ? Math.floor((new Date() - new Date(s.registered_at)) / 3600000)
                  : null
                return (
                  <div
                    key={s.id}
                    className={`flex items-center gap-3 px-5 py-3.5 hover:bg-slate-50 transition-colors cursor-pointer ${
                      i !== recentNew.length - 1 ? 'border-b border-slate-50' : ''
                    }`}
                  >
                    {/* avatar */}
                    <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-purple-100 to-violet-100 flex items-center justify-center text-purple-600 font-bold text-xs flex-shrink-0">
                      {s.name?.charAt(0) || '#'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-slate-800 font-semibold text-sm truncate">{s.name}</p>
                      <p className="text-slate-400 text-xs mt-0.5">
                        {hours !== null
                          ? hours < 24 ? `منذ ${hours} ساعة` : `منذ ${Math.floor(hours / 24)} يوم`
                          : '—'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-xs font-mono text-slate-400">#{s.id}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        parseInt(s.total_shipments) > 0
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-slate-100 text-slate-500'
                      }`}>
                        {parseInt(s.total_shipments) || 0} طرد
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* الإحصائيات السريعة */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-50">
            <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center">
              <Activity size={15} className="text-blue-600" />
            </div>
            <h2 className="font-bold text-slate-800 text-sm">ملخص اليوم</h2>
          </div>
          <div className="px-5 py-2">
            <StatRow
              label="إجمالي الطرود"
              value={totalShipments.toLocaleString('ar-SA')}
              icon={Package}
              color={{ bg: 'bg-blue-50', icon: 'text-blue-600', text: 'text-blue-600' }}
            />
            <StatRow
              label="مكالمات اليوم"
              value={calledToday}
              icon={Phone}
              color={{ bg: 'bg-green-50', icon: 'text-green-600', text: 'text-green-600' }}
            />
            <StatRow
              label="متاجر تحتاج تواصل"
              value={pendingNewCalls}
              icon={Store}
              color={{ bg: 'bg-purple-50', icon: 'text-purple-600', text: 'text-purple-600' }}
            />
            <StatRow
              label="الإجمالي الكلي"
              value={(counts.total || 0).toLocaleString('ar-SA')}
              icon={Activity}
              color={{ bg: 'bg-slate-100', icon: 'text-slate-500', text: 'text-slate-700' }}
            />
          </div>

          {/* شريط التوزيع لكل فئة */}
          <div className="px-5 pb-5 pt-3 border-t border-slate-50 space-y-3 mt-1">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">توزيع الفئات</p>
            {[
              { label: 'نشط يشحن',    v: counts.active_shipping || 0, color: 'bg-emerald-500', text: 'text-emerald-600' },
              { label: 'ساخن',         v: counts.hot_inactive    || 0, color: 'bg-amber-500',   text: 'text-amber-600'  },
              { label: 'بارد',         v: counts.cold_inactive   || 0, color: 'bg-red-500',     text: 'text-red-600'    },
              { label: 'جديدة',        v: counts.incubating      || 0, color: 'bg-purple-500',  text: 'text-purple-600' },
            ].map(row => {
              const pct = counts.total ? Math.round((row.v / counts.total) * 100) : 0
              return (
                <div key={row.label}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-slate-500">{row.label}</span>
                    <span className={`text-xs font-bold ${row.text}`}>{row.v.toLocaleString('ar-SA')}</span>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${row.color} rounded-full transition-all duration-700`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
