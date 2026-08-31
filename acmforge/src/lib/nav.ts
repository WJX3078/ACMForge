import {
  BookOpen,
  CopyCheck,
  FlaskConical,
  GitBranch,
  LayoutDashboard,
  Library,
  ScanSearch,
  Settings2,
  Sparkles,
  Zap,
  type LucideIcon,
} from 'lucide-react'

export interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  group: string
  badge?: string
  hint?: string
}

export const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, group: 'Workspace' },
  { to: '/factory', label: 'Problem Factory', icon: Sparkles, group: 'Factory', badge: 'New' },
  { to: '/ideas', label: 'Idea Pool', icon: Library, group: 'Factory' },
  { to: '/duplicates', label: 'Duplicate Search', icon: ScanSearch, group: 'Factory' },
  { to: '/solutions', label: 'Solutions', icon: GitBranch, group: 'Verification' },
  { to: '/tests', label: 'Test Generator', icon: FlaskConical, group: 'Verification' },
  { to: '/stress', label: 'Stress Test', icon: Zap, group: 'Verification', badge: '1' },
  { to: '/problems', label: 'Problems', icon: CopyCheck, group: 'Library' },
  { to: '/agents', label: 'Agents', icon: BookOpen, group: 'System' },
  { to: '/settings', label: 'Settings', icon: Settings2, group: 'System' },
]

export const NAV_GROUPS = ['Workspace', 'Factory', 'Verification', 'Library', 'System'] as const

export function pageTitle(pathname: string) {
  if (pathname.startsWith('/problems/')) return 'Problem Detail'
  const exact = NAV_ITEMS.find((i) => i.to !== '/' && pathname.startsWith(i.to))
  return exact?.label ?? (pathname === '/' ? 'Dashboard' : 'ACMForge')
}

export const EXTERNAL_LINKS = {
  github: 'https://github.com',
}
