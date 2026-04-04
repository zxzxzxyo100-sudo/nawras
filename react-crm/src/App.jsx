import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { DISABLE_POINTS_AND_PERFORMANCE } from './config/features'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { StoresProvider } from './contexts/StoresContext'
import { PointsProvider, usePoints } from './contexts/PointsContext'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import NewStores from './pages/NewStores'
import ActiveStores from './pages/ActiveStores'
import HotInactive from './pages/HotInactive'
import ColdInactive from './pages/ColdInactive'
import IncubationPath from './pages/IncubationPath'
import IncubationCallDelay from './pages/IncubationCallDelay'
import Tasks from './pages/Tasks'
import Users from './pages/Users'
import Kanban from './pages/Kanban'
import VipMerchants from './pages/VipMerchants'
import MyPerformance from './pages/MyPerformance'
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

function AppRoutes() {
  const { user, loading } = useAuth()
  if (loading) return <div className="min-h-screen flex items-center justify-center text-slate-500">جارٍ التحميل...</div>

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
      <Route element={<PrivateRoute><Layout /></PrivateRoute>}>
        <Route path="/"             element={<Dashboard />} />
        <Route path="/new"          element={<PrivateRoute view="new"><NewStores /></PrivateRoute>} />
        <Route path="/active"       element={<PrivateRoute view="active"><ActiveStores /></PrivateRoute>} />
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
          path="/incubation/:tabKey"
          element={<PrivateRoute view="incubation"><IncubationPath /></PrivateRoute>}
        />
        <Route path="/tasks"        element={<PrivateRoute view="tasks"><Tasks /></PrivateRoute>} />
        <Route
          path="/performance"
          element={(
            <PrivateRoute view="tasks">
              {DISABLE_POINTS_AND_PERFORMANCE
                ? <Navigate to="/tasks" replace />
                : <MyPerformance />}
            </PrivateRoute>
          )}
        />
        <Route path="/users"        element={<PrivateRoute view="users"><Users /></PrivateRoute>} />
        <Route path="/kanban"       element={<PrivateRoute view="dashboard"><Kanban /></PrivateRoute>} />
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
