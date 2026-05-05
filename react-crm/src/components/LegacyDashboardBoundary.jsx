import { Component, useState } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

class LegacyDashboardBoundaryInner extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, message: '' }
  }

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      message: error?.message || 'حدث خطأ غير متوقع أثناء تحميل هذا الجزء.',
    }
  }

  componentDidCatch() {
    // Keep quiet in UI; no-op intentionally.
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback(this.state.message)
    }
    return this.props.children
  }
}

export default function LegacyDashboardBoundary({ children }) {
  const [nonce, setNonce] = useState(0)

  function fallback(message) {
    return (
      <div className="min-h-[55vh] flex items-center justify-center">
        <div className="max-w-xl w-full rounded-2xl border border-amber-200 bg-amber-50 p-6 text-right shadow-sm">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
              <AlertTriangle size={20} />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-base font-black text-amber-900">تعذر تحميل جزء من لوحة المتابعة</h2>
              <p className="mt-1 text-sm text-amber-800/90">
                يمكنك متابعة العمل من الروابط الجانبية مثل «جمع البيانات والمتابعة».
              </p>
              <p className="mt-2 text-xs text-amber-700/90 break-words">{message}</p>
              <button
                type="button"
                onClick={() => setNonce(v => v + 1)}
                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-amber-600 px-3 py-2 text-xs font-bold text-white hover:bg-amber-700"
              >
                <RefreshCw size={13} />
                إعادة تحميل الجزء
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <LegacyDashboardBoundaryInner key={nonce} fallback={fallback}>
      {children}
    </LegacyDashboardBoundaryInner>
  )
}
