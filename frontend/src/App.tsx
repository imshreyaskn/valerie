import React, { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Layout from './components/Layout';

// Lazy-loaded pages for bundle code-splitting
const MissionControl     = lazy(() => import('./pages/MissionControl'));
const Campaigns          = lazy(() => import('./pages/Campaigns'));
const InvestigationBoard = lazy(() => import('./pages/InvestigationBoard'));
const Findings           = lazy(() => import('./pages/Findings'));
const Weaknesses         = lazy(() => import('./pages/Weaknesses'));
const Endpoints          = lazy(() => import('./pages/Endpoints'));
const ApiKeys            = lazy(() => import('./pages/ApiKeys'));
const Settings           = lazy(() => import('./pages/Settings'));
const Login              = lazy(() => import('./pages/Login'));
const Landing            = lazy(() => import('./pages/Landing'));

export function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-parchment">
      <span className="font-mono text-xs tracking-[0.3em] text-steel uppercase animate-pulse select-none">
        VALERIE
      </span>
    </div>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <Routes>
        {/* Public routes */}
        <Route path="/"      element={<Landing />} />
        <Route path="/login" element={<Login />} />

        {/* Protected workstation routes */}
        <Route path="/dashboard" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          {/* Primary nav — spec-mandated names */}
          <Route index                  element={<MissionControl />} />
          <Route path="campaigns"       element={<Campaigns />} />
          <Route path="investigation"   element={<InvestigationBoard />} />
          <Route path="findings"        element={<Findings />} />
          <Route path="weaknesses"      element={<Weaknesses />} />
          <Route path="endpoints"       element={<Endpoints />} />
          {/* Secondary nav */}
          <Route path="keys"            element={<ApiKeys />} />
          <Route path="settings"        element={<Settings />} />
          {/* ponytail: legacy redirects so old bookmarks work */}
          <Route path="evaluations"     element={<Navigate to="/dashboard/campaigns" replace />} />
          <Route path="knowledge"       element={<Navigate to="/dashboard/weaknesses" replace />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
