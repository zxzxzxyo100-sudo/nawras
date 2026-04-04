import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { StoresProvider } from './contexts/StoresContext'
import { PointsProvider } from './contexts/PointsContext'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import NewStores from './pages/NewStores'
import ActiveStores from './pages/ActiveStores'
import HotInactive from './pages/HotInactive'
import ColdInactive from './pages/ColdInactive'
import IncubationPath from './pages/IncubationPath'
import Tasks from './pages/Tasks'
import Users from './pages/Users'
import Kanban from './pages/Kanban'

function PrivateRoute({ children, view }) {
  const { user, loading, can } = useAuth()
  if (loading) return <div className="min-h-screen flex items-center justify-center text-slate-500">جارٍ التحميل...</div>
  if (!user) return <Navigate to="/login" replace />
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
        <Route path="/hot-inactive" element={<PrivateRoute view="hot_inactive"><HotInactive /></PrivateRoute>} />
        <Route path="/cold-inactive"element={<PrivateRoute view="cold_inactive"><ColdInactive /></PrivateRoute>} />
        <Route path="/incubation"   element={<PrivateRoute view="incubation"><IncubationPath /></PrivateRoute>} />
        <Route path="/tasks"        element={<PrivateRoute view="tasks"><Tasks /></PrivateRoute>} />
        <Route path="/performance"  element={<Navigate to="/tasks" replace />} />
        <Route path="/users"        element={<PrivateRoute view="users"><Users /></PrivateRoute>} />
        <Route path="/kanban"       element={<PrivateRoute view="dashboard"><Kanban /></PrivateRoute>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <StoresProvider>
          <PointsProvider>
            <AppRoutes />
          </PointsProvider>
        </StoresProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
