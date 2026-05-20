// src/App.js

import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

import SelectApplication from './pages/SelectApplication';
import SelectConfiguration from './pages/SelectConfiguration';
import ExploreMetrics from './pages/ExploreMetrics';
import IdentifyIssues from './pages/IdentifyIssues';
import Recommendations from './pages/Recommendations';
import CompareView from './pages/CompareView';
import Correlations from './pages/Correlations';

import Sidebar from './components/Sidebar';
import { SelectionProvider, useSelection } from './state/SelectionContext';

import './App.css';

// Create a client for React Query
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false, // Don't refetch when window regains focus
      refetchOnMount: false, // Don't refetch on component mount if data exists
      refetchOnReconnect: false, // Don't refetch on network reconnect
      retry: 2, // Retry failed requests twice
      staleTime: 5 * 60 * 1000, // Data is fresh for 5 minutes
      gcTime: 10 * 60 * 1000, // Cache persists for 10 minutes (replaces cacheTime)
      // Disable performance tracking to avoid memory issues
      meta: {
        persist: false,
      },
    },
  },
});

const GuardedRoute = ({ children, requireConfig = false, requireRun = false }) => {
  const { selectedApp, selectedConfig, selectedRun } = useSelection();
  if (!selectedApp) return <Navigate to="/apps" replace />;
  if (requireConfig && !selectedConfig) return <Navigate to={`/apps/${selectedApp}/configs`} replace />;
  if (requireRun && !selectedRun) return <Navigate to={`/apps/${selectedApp}/configs`} replace />;
  return children;
};

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <SelectionProvider>
          <a href="#main" className="sr-only focus:not-sr-only focus:p-2 focus:bg-[var(--surface-2)]">
            Skip to content
          </a>
          <div className="flex min-h-screen" style={{ background: 'var(--bg)', color: 'var(--text)' }}>
            <Sidebar />
            <main id="main" className="flex-1 p-6 md:p-8">
              <Routes>
                <Route path="/" element={<Navigate to="/apps" replace />} />
                <Route path="/apps" element={<SelectApplication />} />
                <Route path="/apps/:appId/configs" element={<SelectConfiguration />} />
                <Route
                  path="/apps/:appId/run/:runId/metrics"
                  element={
                    <GuardedRoute requireRun>
                      <ExploreMetrics />
                    </GuardedRoute>
                  }
                />
                <Route
                  path="/apps/:appId/run/:runId/issues"
                  element={
                    <GuardedRoute requireRun>
                      <IdentifyIssues />
                    </GuardedRoute>
                  }
                />
                <Route
                  path="/apps/:appId/run/:runId/recommendations"
                  element={
                    <GuardedRoute requireRun>
                      <Recommendations />
                    </GuardedRoute>
                  }
                />
                <Route path="/compare" element={<CompareView />} />
                <Route path="/correlations" element={<Correlations />} />
              </Routes>
            </main>
          </div>
        </SelectionProvider>
      </Router>
      {/* React Query DevTools - only shows in development */}
      <ReactQueryDevtools initialIsOpen={false} position="bottom-right" />
    </QueryClientProvider>
  );
}

export default App;