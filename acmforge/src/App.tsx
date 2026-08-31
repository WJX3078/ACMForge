import { lazy } from 'react'
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { AgentEngineProvider } from '@/hooks/useAgentEngine'
import { ThemeProvider } from '@/hooks/useTheme'
import { UiProvider } from '@/hooks/useUi'
import Dashboard from '@/pages/Dashboard'

// Dashboard is the landing route, so it stays in the entry chunk.
// Everything else is fetched on demand (see manualChunks in vite.config.ts).
const ProblemFactory = lazy(() => import('@/pages/ProblemFactory'))
const IdeaPool = lazy(() => import('@/pages/IdeaPool'))
const DuplicateSearch = lazy(() => import('@/pages/DuplicateSearch'))
const Solutions = lazy(() => import('@/pages/Solutions'))
const TestGenerator = lazy(() => import('@/pages/TestGenerator'))
const StressTest = lazy(() => import('@/pages/StressTest'))
const Problems = lazy(() => import('@/pages/Problems'))
const ProblemDetail = lazy(() => import('@/pages/ProblemDetail'))
const Agents = lazy(() => import('@/pages/Agents'))
const Settings = lazy(() => import('@/pages/Settings'))

export default function App() {
  return (
    <ThemeProvider>
      <UiProvider>
        <AgentEngineProvider>
          <HashRouter>
            <Routes>
              <Route element={<AppShell />}>
                <Route path="/" element={<Dashboard />} />
                <Route path="/factory" element={<ProblemFactory />} />
                <Route path="/ideas" element={<IdeaPool />} />
                <Route path="/duplicates" element={<DuplicateSearch />} />
                <Route path="/solutions" element={<Solutions />} />
                <Route path="/tests" element={<TestGenerator />} />
                <Route path="/stress" element={<StressTest />} />
                <Route path="/problems" element={<Problems />} />
                <Route path="/problems/:id" element={<ProblemDetail />} />
                <Route path="/agents" element={<Agents />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Route>
            </Routes>
          </HashRouter>
        </AgentEngineProvider>
      </UiProvider>
    </ThemeProvider>
  )
}
