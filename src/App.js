import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { supabase } from './supabaseClient';

import Welcome from './pages/Welcome';
import UserDashboard from './pages/UserDashboard';
import AdminDashboard from './pages/AdminDashboard';
import Dashboard from './pages/Dashboard';
import AuthGuard from './components/AuthGuard';
import { checkForInvitationInURL } from './utils/adminUtils';
import AdminCreationPage from './pages/AdminCreationPage';
import ReportComplaint from './pages/ReportComplaint';
import ComplaintDetail from './pages/ComplaintDetail';
import MapScreen from './pages/MapScreen';
import ErrorBoundary from './components/ErrorBoundary';

function App() {
  const [isInitializing, setIsInitializing] = useState(true);
  
  // Check for invitation codes on app startup and initialize app
  useEffect(() => {
    const initApp = async () => {
      // Check for invitation code
      checkForInvitationInURL();
      setIsInitializing(false);
    };
    
    initApp();
  }, []);

  if (isInitializing) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <Router>
      <ErrorBoundary>
        <Routes>
          {/* Public routes */}
          <Route path="/" element={<Welcome />} />
          <Route path="/admin-invitation" element={<AdminCreationPage />} />
          
          {/* User routes */}
          <Route path="/dashboard" element={
            <AuthGuard allowedRoles={['Public User', 'Field Agent', 'Department Admin', 'Super Admin']}>
              <UserDashboard />
            </AuthGuard>
          } />

          <Route path="/report-complaint" element={
            <AuthGuard allowedRoles={['Public User', 'Field Agent', 'Department Admin', 'Super Admin']}>
              <ReportComplaint />
            </AuthGuard>
          } />

          <Route path="/complaint/:id" element={
            <AuthGuard allowedRoles={['Public User', 'Field Agent', 'Department Admin', 'Super Admin']}>
              <ComplaintDetail />
            </AuthGuard>
          } />

          <Route path="/map" element={
            <ErrorBoundary>
              <AuthGuard allowedRoles={['Public User', 'Field Agent', 'Department Admin', 'Super Admin']}>
                <MapScreen />
              </AuthGuard>
            </ErrorBoundary>
          } />
          
          {/* Admin routes */}
          <Route path="/admin" element={
            <AuthGuard allowedRoles={['Department Admin', 'Super Admin']}>
              <AdminDashboard />
            </AuthGuard>
          } />

          {/* Original Dashboard as fallback (temporary) - replace with proper redirect when ready */}
          <Route path="/dashboard-old" element={
            <AuthGuard allowedRoles={['Public User', 'Field Agent', 'Department Admin', 'Super Admin']}>
              <Dashboard />
            </AuthGuard>
          } />

          {/* Catch-all route */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </ErrorBoundary>
    </Router>
  );
}

export default App;
