import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useState,
  type ReactNode,
} from 'react'
import { advance, initialState, selectAgentView } from '@/services/agentEngine'
import type { AgentId, EngineState } from '@/types'

const TICK_MS = 120

type Action = { type: 'tick'; dt: number } | { type: 'restart' }

function reducer(state: EngineState, action: Action): EngineState {
  switch (action.type) {
    case 'restart':
      return initialState()
    case 'tick':
      return advance(state, action.dt)
  }
}

interface AgentEngineValue {
  state: EngineState
  view: ReturnType<typeof selectAgentView>
  paused: boolean
  setPaused: (v: boolean) => void
  togglePaused: () => void
  restart: () => void
  selected: AgentId | null
  select: (id: AgentId | null) => void
}

const AgentEngineContext = createContext<AgentEngineValue | null>(null)

export function AgentEngineProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, initialState)
  const [paused, setPaused] = useState(false)
  const [selected, setSelected] = useState<AgentId | null>(null)

  useEffect(() => {
    if (paused) return
    const id = window.setInterval(() => {
      // don't burn cycles on a background tab
      if (document.visibilityState === 'hidden') return
      dispatch({ type: 'tick', dt: TICK_MS })
    }, TICK_MS)
    return () => window.clearInterval(id)
  }, [paused])

  const restart = useCallback(() => dispatch({ type: 'restart' }), [])
  const togglePaused = useCallback(() => setPaused((p) => !p), [])
  const select = useCallback((id: AgentId | null) => setSelected(id), [])

  const view = useMemo(() => selectAgentView(state), [state])

  const value = useMemo<AgentEngineValue>(
    () => ({ state, view, paused, setPaused, togglePaused, restart, selected, select }),
    [state, view, paused, togglePaused, restart, selected, select],
  )

  return <AgentEngineContext.Provider value={value}>{children}</AgentEngineContext.Provider>
}

export function useAgentEngine() {
  const ctx = useContext(AgentEngineContext)
  if (!ctx) throw new Error('useAgentEngine must be used inside <AgentEngineProvider>')
  return ctx
}

/** Convenience selector for a single agent's runtime record. */
export function useAgent(id: AgentId) {
  const { state } = useAgentEngine()
  return state.agents[id]
}
