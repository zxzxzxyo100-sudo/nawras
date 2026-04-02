import { useNavigate } from 'react-router-dom'
import { Store, TrendingUp, TrendingDown, Package, RefreshCw, AlertCircle } from 'lucide-react'
import StatCard from '../components/StatCard'
import { useStores } from '../contexts/StoresContext'
import { useAuth } from '../contexts/AuthContext'

export default function Dashboard() {
  const { counts, allStores, callLogs, loading, error, lastLoaded, reload } = useStores()
  const { user } = useAuth()
  const navigate = useNavigate()

  // إحصائيات الطرود
  const totalShipments = allStores.reduce((sum, s) => sum + (parseInt(s.total_shipments) || 0), 0)

  // المتاجر المجمدة
  const frozenCount = allStores.filter(s => s.category === 'frozen').length

  // المتاجر التي لم تُتصل بها اليوم
  const today = new Date().toISOString().split('T')[0]
  const calledToday = Object.values(callLogs).filter(log => {
    const entries = Object.values(log || {})
    return entries.some(e => e?.date?.startsWith(today))
  }).length

  // مهام معلقة (متاجر جديدة بدون مكالمة)
  const pendingNewCalls = allStores.filter(s =>
    s.category === 'incubating' && !callLogs[s.id]?.day0
  ).length

  const pendingInactiveCalls = allStores.filter(s =>
    s.category === 'inactive' && !callLogs[s.id]
  ).length

  // آخر 5 متاجر جديدة
  const recentNew = [...(allStores.filter(s => s.category === 'incubating'))]
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

      {/* KPI Cards */}
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
          title="المتاجر النشطة"
          value={counts.active}
          subtitle={`${calledToday} تم الاتصال اليوم`}
          icon={TrendingUp}
          color="green"
          onClick={() => navigate('/active')}
        />
        <StatCard
          title="المتاجر غير النشطة"
          value={counts.inactive}
          subtitle={`${pendingInactiveCalls} تحتاج متابعة`}
          icon={TrendingDown}
          color="red"
          onClick={() => navigate('/inactive')}
        />
        <StatCard
          title="إجمالي الطرود"
          value={totalShipments}
          subtitle={`عبر ${counts.total} متجر`}
          icon={Package}
          color="blue"
        />
      </div>

      {/* Second row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent new stores */}
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

        {/* Quick stats */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
          <h2 className="font-bold text-slate-800 flex items-center gap-2 mb-4">
            <TrendingUp size={18} className="text-blue-600" />
            ملخص سريع
          </h2>
          <div className="space-y-3">
            {[
              { label: 'مجمدة',          value: frozenCount,          color: 'text-slate-600' },
              { label: 'مكالمات اليوم',  value: calledToday,           color: 'text-green-600' },
              { label: 'تحتاج تواصل (جديدة)', value: pendingNewCalls, color: 'text-purple-600' },
              { label: 'تحتاج استعادة',  value: pendingInactiveCalls,  color: 'text-red-600' },
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
