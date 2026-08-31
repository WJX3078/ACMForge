import { Suspense, lazy } from 'react'
import { ActivityPanel } from '@/components/dashboard/ActivityPanel'
import { Hero } from '@/components/dashboard/Hero'
import { PipelineBoard } from '@/components/dashboard/PipelineBoard'
import { RecentProblems } from '@/components/dashboard/RecentProblems'
import { StatsGrid } from '@/components/dashboard/StatsGrid'
import { PageHeader } from '@/components/layout/AppShell'
import { Skeleton } from '@/components/ui/primitives'

// Recharts is the heaviest dependency in the app and only the dashboard uses
// it, so it is split out of the entry chunk and streamed in.
const ThroughputChart = lazy(() =>
  import('@/components/dashboard/Charts').then((m) => ({ default: m.ThroughputChart })),
)

export default function Dashboard() {
  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Every stage of the problem factory, streaming in real time."
      />
      <Hero />
      <StatsGrid />
      <div className="grid gap-3 xl:grid-cols-3">
        <div className="min-w-0 space-y-3 xl:col-span-2">
          <PipelineBoard />
          <RecentProblems />
        </div>
        <div className="min-w-0 space-y-3">
          <Suspense fallback={<Skeleton className="h-[220px] w-full" />}>
            <ThroughputChart />
          </Suspense>
          <ActivityPanel />
        </div>
      </div>
    </div>
  )
}
