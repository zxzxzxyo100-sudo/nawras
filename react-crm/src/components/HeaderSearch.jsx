import { useState } from 'react'
import { Search } from 'lucide-react'
import StoreNameAutocomplete from './StoreNameAutocomplete'
import { useStores } from '../contexts/StoresContext'

/**
 * بحث عام بالهيدر — يعيد استخدام StoreNameAutocomplete (بحث سيرفر جاهز)
 * ثم يفتح StoreDrawer بالبيانات الكاملة من allStores (بدون طلب API إضافي).
 */
export default function HeaderSearch({ onOpenStore, className = '' }) {
  const { allStores } = useStores()
  const [query, setQuery] = useState('')
  const [pickedId, setPickedId] = useState(null)

  function handlePickedIdChange(id) {
    setPickedId(id)
    if (id == null) return
    const store = allStores.find(s => String(s.id) === String(id))
    if (store) onOpenStore(store)
    setQuery('')
    setPickedId(null)
  }

  return (
    <div className={`relative w-full ${className}`}>
      <Search size={15} className="pointer-events-none absolute top-1/2 -translate-y-1/2 start-3 text-slate-400 z-10" />
      <StoreNameAutocomplete
        value={query}
        onChange={setQuery}
        selectedStoreId={pickedId}
        onSelectedStoreIdChange={handlePickedIdChange}
        isElite
        placeholder="ابحث عن متجر، رقم هاتف، أو أي بيانات..."
        inputClassName="ps-9 !bg-slate-50/80 !border-slate-200 focus:!bg-white"
      />
    </div>
  )
}
