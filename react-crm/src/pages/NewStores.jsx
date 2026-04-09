import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Store, RefreshCw } from 'lucide-react'
import StoreTable from '../components/StoreTable'
import StoreDrawer from '../components/StoreDrawer'
import { useStores } from '../contexts/StoresContext'
import { storeBucketLabel } from '../utils/storeBuckets'
import { dateOnlyFromStoreField, isStoreStrictlyNew } from '../utils/storeFilters'
import NewMerchantOnboardingModal from '../components/NewMerchantOnboardingModal'
import { needsNewMerchantOnboardingSurvey } from '../constants/newMerchantOnboardingSurvey'
import { IS_STAGING_OR_DEV } from '../config/envFlags'

/** يُستخرج من الرابط: كل المتاجر | جديدة 48 ساعة | تحت الاحتضان */
function useListPreset(searchParams) {
  if (searchParams.get('bucket') === 'incubating') return 'incubating'
  if (searchParams.get('view') === 'new48') return 'new48'
  return 'all'
}

export default function NewStores() {
  const [searchParams] = useSearchParams()
  const listPreset = useListPreset(searchParams)

  const { allStores, counts, callLogs, loading, reload, shipmentsRangeMeta, newMerchantOnboardingDoneIds } =
    useStores()
  const [selected, setSelected] = useState(null)
  const [onboardingStore, setOnboardingStore] = useState(null)

  const filteredForCount = useMemo(() => {
    if (listPreset === 'incubating') {
      return allStores.filter(s => s.bucket === 'incubating' && !isStoreStrictlyNew(s))
    }
    if (listPreset === 'new48') {
      return allStores.filter(s => isStoreStrictlyNew(s))
    }
    return allStores
  }, [allStores, listPreset])

  const totalCount = counts?.total ?? allStores.length

  function handleEliteCall(store) {
    if (IS_STAGING_OR_DEV && needsNewMerchantOnboardingSurvey(store, newMerchantOnboardingDoneIds)) {
      setOnboardingStore(store)
      return
    }
    const p = store.phone
    if (p) window.open(`tel:${String(p).replace(/\s/g, '')}`, '_self')
  }

  const { title, subtitle } = useMemo(() => {
    if (listPreset === 'incubating') {
      return {
        title: 'تحت الاحتضان',
        subtitle: `${filteredForCount.length.toLocaleString('ar-SA')} متجر — مسار المكالمات (بدون «جديد 48 ساعة»)`,
      }
    }
    if (listPreset === 'new48') {
      return {
        title: 'جديدة',
        subtitle: `${filteredForCount.length.toLocaleString('ar-SA')} متجر — جديد فقط (48 ساعة ولم يشحن بعد)`,
      }
    }
    return {
      title: 'المتاجر',
      subtitle: `${totalCount.toLocaleString('ar-SA')} متجر — كل الخانات (جميع المتاجر)`,
    }
  }, [listPreset, filteredForCount.length, totalCount])

  const extraColumns = [
    {
      key: 'bucket',
      label: 'حالة المتجر',
      render: s => (
        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200/90 whitespace-nowrap">
          {listPreset === 'new48'
            ? (s.lifecycle_label_ar || 'متجر جديد')
            : storeBucketLabel(s.bucket)}
        </span>
      ),
    },
    {
      key: 'days_old',
      label: 'عمر المتجر',
      render: s => {
        const dOnly = dateOnlyFromStoreField(s.registered_at)
        if (!dOnly) return '—'
        const t = new Date(`${dOnly}T12:00:00`).getTime()
        if (Number.isNaN(t)) return '—'
        const days = Math.floor((Date.now() - t) / 86400000)
        return <span className="text-xs font-medium">{Math.max(0, days)} يوم</span>
      },
    },
    {
      key: 'call_status',
      label: 'حالة المتابعة',
      render: s => {
        const log = callLogs[s.id] || {}
        if (log.day0) return <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">تم التواصل</span>
        return <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">تحتاج مكالمة</span>
      },
    },
  ]

  return (
    <div className="space-y-5" dir="rtl">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 rounded-2xl border border-white/25 bg-white/45 backdrop-blur-xl px-5 py-4 shadow-[0_12px_40px_-16px_rgba(15,23,42,0.35)] ring-1 ring-violet-200/30">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Store size={24} className="text-purple-600" />
            {title}
          </h1>
          <p className="text-slate-600 text-sm mt-0.5">{subtitle}</p>
        </div>
        <button
          type="button"
          onClick={reload}
          disabled={loading}
          className="flex shrink-0 items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-slate-700 border border-white/40 bg-white/50 hover:bg-white/80 shadow-sm backdrop-blur-sm transition-colors disabled:opacity-60"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          تحديث
        </button>
      </div>

      <StoreTable
        variant="elite"
        stores={allStores}
        listPreset={listPreset}
        enableBucketFilter
        onSelectStore={setSelected}
        onRestoreStore={setSelected}
        extraColumns={extraColumns}
        emptyMsg="لا توجد متاجر"
        parcelsColumnSub={
          shipmentsRangeMeta?.from && shipmentsRangeMeta?.to
            ? `من ${shipmentsRangeMeta.from} إلى ${shipmentsRangeMeta.to}`
            : undefined
        }
        eliteNeedsNewMerchantOnboarding={s =>
          needsNewMerchantOnboardingSurvey(s, newMerchantOnboardingDoneIds)}
        onEliteNewMerchantOnboardingClick={setOnboardingStore}
        onCallStore={handleEliteCall}
      />

      {onboardingStore && (
        <NewMerchantOnboardingModal
          store={onboardingStore}
          onClose={() => setOnboardingStore(null)}
          onSaved={() => {
            const s = onboardingStore
            setOnboardingStore(null)
            reload()
            if (IS_STAGING_OR_DEV && s?.phone) {
              window.open(`tel:${String(s.phone).replace(/\s/g, '')}`, '_self')
            }
          }}
        />
      )}

      {selected && (
        <StoreDrawer store={selected} onClose={() => setSelected(null)} qvNeedsFreezeSource="incubation" />
      )}
    </div>
  )
}
