import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { DISABLE_POINTS_AND_PERFORMANCE } from './config/features'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { StoresProvider } from './contexts/StoresContext'
import { PointsProvider, usePoints } from './contexts/PointsContext'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import QuickVerification from './pages/QuickVerification'
import NewStores from './pages/NewStores'
import ActiveStores from './pages/ActiveStores'
import LogisticsAnalytics from './pages/LogisticsAnalytics'
import FrozenStores from './pages/FrozenStores'
import HotInactive from './pages/HotInactive'
import ColdInactive from './pages/ColdInactive'
import IncubationPath from './pages/IncubationPath'
import IncubationCallDelay from './pages/IncubationCallDelay'
import IncubationNewCompleted from './pages/IncubationNewCompleted'
import Users from './pages/Users'
import VipMerchants from './pages/VipMerchants'
import MyPerformance from './pages/MyPerformance'
import ExecutiveStaffPerformance from './pages/ExecutiveStaffPerformance'
import TeamPerformanceStatistics from './pages/TeamPerformanceStatistics'
import ConversionRateReport from './pages/ConversionRateReport'
import SatisfactionReport from './pages/SatisfactionReport'
import RecoveryReport from './pages/RecoveryReport'
import Tasks from './pages/Tasks'
import LeadManagement from './pages/LeadManagement'
import GoldCoinAnimation from './components/GoldCoinAnimation'

function PrivateRoute({ children, view, viewAny }) {
  const { user, loading, can } = useAuth()
  if (loading) return <div className="min-h-screen flex items-center justify-center text-slate-500">جارٍ التحميل...</div>
  if (!user) return <Navigate to="/login" replace />
  if (viewAny?.length) {
    if (!viewAny.some(v => can(v))) return <Navigate to="/" replace />
    return children
  }
  if (view && !can(view)) return <Navigate to="/" replace />
  return children
}

/** مسؤول الاستعادة: يفتح «المهام» مباشرة حيث تُعرض خانة المتابعة والطابور */
function HomeRoot() {
  const { user } = useAuth()
  if (user?.role === 'inactive_manager') {
    return <Navigate to="/tasks" replace />
  }
  // أدوار جمع البيانات لا تعتمد على لوحة المتاجر الرئيسية.
  if (user?.role === 'data_collector' || user?.role === 'admin') {
    return <Navigate to="/lead-management" replace />
  }
  return <Dashboard />
}

function AppRoutes() {
  const { user, loading } = useAuth()
  if (loading) return <div className="min-h-screen flex items-center justify-center text-slate-500">جارٍ التحميل...</div>

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
      <Route element={<PrivateRoute><Layout /></PrivateRoute>}>
        <Route path="/"             element={<HomeRoot />} />
        <Route path="/tasks"       element={<PrivateRoute view="tasks"><Tasks /></PrivateRoute>} />
        <Route path="/lead-management" element={<PrivateRoute view="lead_management"><LeadManagement /></PrivateRoute>} />
        <Route
          path="/quick-verification"
          element={<PrivateRoute view="quick_verification"><QuickVerification /></PrivateRoute>}
        />
        <Route path="/new"          element={<PrivateRoute view="new"><NewStores /></PrivateRoute>} />
        <Route
          path="/active"
          element={(
            <PrivateRoute view="active">
              <Navigate to="/active/pending" replace />
            </PrivateRoute>
          )}
        />
        <Route path="/active/frozen" element={<Navigate to="/frozen" replace />} />
        <Route
          path="/frozen"
          element={(
            <PrivateRoute view="active">
              <FrozenStores />
            </PrivateRoute>
          )}
        />
        <Route
          path="/active/workflow"
          element={(
            <PrivateRoute view="active">
              <Navigate to="/active/pending" replace />
            </PrivateRoute>
          )}
        />
        <Route
          path="/active/:activeSegment"
          element={(
            <PrivateRoute view="active">
              <ActiveStores />
            </PrivateRoute>
          )}
        />
        <Route path="/hot-inactive" element={<Navigate to="/hot-inactive/all" replace />} />
        <Route
          path="/hot-inactive/:recoverySegment"
          element={(
            <PrivateRoute viewAny={['hot_inactive', 'cold_inactive']}>
              <HotInactive />
            </PrivateRoute>
          )}
        />
        <Route path="/cold-inactive"element={<PrivateRoute view="cold_inactive"><ColdInactive /></PrivateRoute>} />
        <Route path="/vip"          element={<PrivateRoute view="vip_merchants"><VipMerchants /></PrivateRoute>} />
        <Route path="/incubation" element={<Navigate to="/incubation/call-1" replace />} />
        <Route
          path="/incubation/call-delay"
          element={<PrivateRoute view="incubation"><IncubationCallDelay /></PrivateRoute>}
        />
        <Route
          path="/incubation/new-completed"
          element={<PrivateRoute view="incubation"><IncubationNewCompleted /></PrivateRoute>}
        />
        <Route
          path="/incubation/:tabKey"
          element={<PrivateRoute view="incubation"><IncubationPath /></PrivateRoute>}
        />
        <Route
          path="/performance"
          element={(
            <PrivateRoute view="dashboard">
              {DISABLE_POINTS_AND_PERFORMANCE
                ? <Navigate to="/" replace />
                : <MyPerformance />}
            </PrivateRoute>
          )}
        />
        <Route
          path="/staff-performance/stats"
          element={<PrivateRoute view="staff_performance"><TeamPerformanceStatistics /></PrivateRoute>}
        />
        <Route
          path="/staff-performance/conversion-report"
          element={<PrivateRoute view="staff_performance"><ConversionRateReport /></PrivateRoute>}
        />
        <Route
          path="/staff-performance/satisfaction-report"
          element={<PrivateRoute view="staff_performance"><SatisfactionReport /></PrivateRoute>}
        />
        <Route
          path="/staff-performance/recovery-report"
          element={<PrivateRoute view="staff_performance"><RecoveryReport /></PrivateRoute>}
        />
        <Route
          path="/staff-performance"
          element={<PrivateRoute view="staff_performance"><ExecutiveStaffPerformance /></PrivateRoute>}
        />
        <Route path="/users"        element={<PrivateRoute view="users"><Users /></PrivateRoute>} />
        <Route
          path="/analytics/logistics"
          element={<PrivateRoute view="dashboard"><LogisticsAnalytics /></PrivateRoute>}
        />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

function GlobalAnimations() {
  const { coinTrigger, earnedPoints, showJackpot, setShowJackpot } = usePoints()
  if (DISABLE_POINTS_AND_PERFORMANCE) return null
  return (
    <GoldCoinAnimation
      trigger={coinTrigger}
      points={earnedPoints}
      showJackpot={showJackpot}
      onJackpotDone={() => setShowJackpot(false)}
    />
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <StoresProvider>
          <PointsProvider>
            <GlobalAnimations />
            <AppRoutes />
          </PointsProvider>
        </StoresProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
