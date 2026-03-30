import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import OfficerDashboard from './pages/OfficerDashboard';
import ManagerDashboard from './pages/ManagerDashboard';
import TaskDetail from './pages/TaskDetail';
import MerchantDetail from './pages/MerchantDetail';
import { ThemeProvider } from './contexts/ThemeContext';
import { AuthProvider } from './contexts/AuthContext';
import './App.css';

function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <Router>
          <div className="flex min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-200">
            <Sidebar />
            <main className="flex-1 overflow-y-auto">
              <Routes>
                <Route path="/" element={<Navigate to="/dashboard" />} />
                <Route path="/dashboard" element={<OfficerDashboard />} />
                <Route path="/manager" element={<ManagerDashboard />} />
                <Route path="/tasks/:id" element={<TaskDetail />} />
                <Route path="/merchants/:id" element={<MerchantDetail />} />
              </Routes>
            </main>
          </div>
        </Router>
      </ThemeProvider>
    </AuthProvider>
  );
}

export default App;
