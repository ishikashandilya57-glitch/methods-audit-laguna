import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

import { AuthProvider, useAuth } from './hooks/useAuth';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import AuditListPage from './pages/AuditListPage';
import AuditDetailPage from './pages/AuditDetailPage';
import ChecklistPage from './pages/ChecklistPage';
import OperationsPage from './pages/OperationsPage';
import RoadmapPage from './pages/RoadmapPage';
import Layout from './components/common/Layout';

const PrivateRoute = ({ children }) => {
  const { user } = useAuth();
  return user ? children : <Navigate to="/login" replace />;
};

const PublicRoute = ({ children }) => {
  const { user } = useAuth();
  return !user ? children : <Navigate to="/dashboard" replace />;
};

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
      <Route path="/register" element={<Navigate to="/login" replace />} />

      <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="operations" element={<OperationsPage />} />
        <Route path="roadmap" element={<RoadmapPage />} />
        <Route path="audits" element={<AuditListPage />} />
        <Route path="audits/new" element={<Navigate to="/audits" replace />} />
        <Route path="audits/:id" element={<AuditDetailPage />} />
        <Route path="audits/:auditId/checklists/:checklistId" element={<ChecklistPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
        <ToastContainer position="top-right" autoClose={3000} />
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
