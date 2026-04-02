import { useNavigate } from 'react-router-dom'
import {
  Store, Package, RefreshCw, AlertCircle,
  TrendingUp, Flame, Snowflake,
} from 'lucide-react'
import StatCard from '../components/StatCard'
import { useStores } from '../contexts/StoresContext'
import { useAuth } from '../contexts/AuthContext'

export default function Dashboard() {
  const { counts, stores, allStores, callLogs, loading, error, lastLoaded, reload } = useStores()
  const { user } = useAuth()
  const navigate = useNavigate()

  const totalShipments = allStores.reduce((sum, s) => sum + (parseInt(s.total_shipments) || 0), 0)

  const today = new Date().toISOString().split('T')[0]
  const calledToday = Object.values(callLogs).filter(log =>
    Object.values(log || {}).some(e => e?.date?.startsWith(today))
  ).length

  const pendingNewCalls = (stores.incubating || []).filter(s => !callLogs[s.id]?.day0).length

  // أحدث 5 متاجر جديدة
  const recentNew = [...(stores.incubating || [])]
    .sort((a, b) => new Date(b.registered_at || 0) - new Date(a.registered_at || 0))
    .slice(0, 5)

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-slate-500">
      <RefreshCw size={24} className="animate-spin ml-2" />
      جارٍ تحميل البيانات...
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

  // ضمان التوافق: المجموع دائماً = total_active
  const activeSum = (counts.active_shipping || 0) + (counts.hot_inactive || 0) + (counts.cold_inactive || 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">لوحة التحكم</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            مرحباً {user?.fullname} •{' '}
            {lastLoaded ? `آخر تحديث: ${lastLoaded.toLocaleTimeString('ar-SA')}` : ''}
          </p>
        </div>
        <button
          onClick={reload}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors shadow-sm"
        >
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          تحديث
        </button>
      </div>

      {/* بطاقة الإجمالي */}
      <div className="bg-gradient-to-r from-slate-800 to-slate-900 rounded-2xl p-5 shadow-md text-white flex items-center justify-between">
        <div>
          <p className="text-slate-400 text-sm font-medium mb-1">إجمالي المتاجر المسجّلة في API</p>
          <p className="text-4xl font-black">{(counts.total || 0).toLocaleString('ar-SA')}</p>
          <p className="text-slate-400 text-xs mt-1">
            {counts.incubating || 0} جديد + {counts.active_shipping || 0} نشط + {counts.hot_inactive || 0} ساخن + {counts.cold_inactive || 0} بارد
          </p>
        </div>
        <div className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center">
          <Package size={28} className="text-white" />
        </div>
      </div>

      {/* KPI Cards — 4 خانات */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="المتاجر الجديدة"
          value={counts.incubating}
          subtitle={`${pendingNewCalls} تحتاج مكالمة`}
          icon={Store}
          color="purple"
          onClick={() => navigate('/new')}
        />
        <StatCard
          title="نشط يشحن (≤ 14 يوم)"
          value={counts.active_shipping}
          subtitle="شحن خلال آخر 14 يوم"
          icon={TrendingUp}
          color="green"
          onClick={() => navigate('/active')}
        />
        <StatCard
          title="غير نشط ساخن (15-60 يوم)"
          value={counts.hot_inactive}
          subtitle="انقطع 15 إلى 60 يوم"
          icon={Flame}
          color="amber"
          onClick={() => navigate('/hot-inactive')}
        />
        <StatCard
          title="غير نشط بارد (> 60 يوم)"
          value={counts.cold_inactive}
          subtitle="انقطع أكثر من 60 يوم أو لم يشحن"
          icon={Snowflake}
          color="red"
          onClick={() => navigate('/cold-inactive')}
        />
      </div>

      {/* Second row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* أحدث متاجر جديدة */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-slate-800 flex items-center gap-2">
              <Store size={18} className="text-purple-600" />
              أحدث المتاجر المسجلة
            </h2>
            <button onClick={() => navigate('/new')} className="text-blue-600 text-xs font-medium hover:underline">عرض الكل</button>
          </div>
          {recentNew.length === 0 ? (
            <p className="text-slate-400 text-sm text-center py-6">لا توجد متاجر جديدة</p>
          ) : (
            <div className="space-y-2">
              {recentNew.map(s => (
                <div key={s.id} className="flex items-center justify-between py-2.5 border-b border-slate-50 last:border-0">
                  <div>
                    <p className="text-slate-800 font-medium text-sm">{s.name}</p>
                    <p className="text-slate-400 text-xs mt-0.5">
                      {s.registered_at ? new Date(s.registered_at).toLocaleDateString('ar-SA') : '—'}
                    </p>
                  </div>
                  <span className="text-xs bg-purple-100 text-purple-700 px-2.5 py-1 rounded-full font-medium">
                    {parseInt(s.total_shipments) || 0} طرد
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ملخص سريع */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
          <h2 className="font-bold text-slate-800 flex items-center gap-2 mb-4">
            <Package size={18} className="text-blue-600" />
            ملخص سريع
          </h2>
          <div className="space-y-3">
            {[
              { label: 'إجمالي الطرود عبر كل المتاجر', value: totalShipments.toLocaleString('ar-SA'), color: 'text-blue-600' },
              { label: 'مكالمات اليوم',                  value: calledToday,                            color: 'text-green-600' },
              { label: 'متاجر جديدة تحتاج تواصل',        value: pendingNewCalls,                        color: 'text-purple-600' },
              { label: 'الإجمالي الكلي (API + جديد)',     value: (counts.total || 0).toLocaleString('ar-SA'), color: 'text-slate-700' },
            ].map(row => (
              <div key={row.label} className="flex items-center justify-between py-2.5 border-b border-slate-50 last:border-0">
                <span className="text-slate-500 text-sm">{row.label}</span>
                <span className={`font-bold text-lg ${row.color}`}>{row.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
