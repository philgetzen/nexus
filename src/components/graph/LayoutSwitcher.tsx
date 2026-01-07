import { Network, GitBranch, Circle } from 'lucide-react'
import type { LayoutAlgorithm } from '@/types'

interface LayoutSwitcherProps {
  layout: LayoutAlgorithm
  onLayoutChange?: (layout: LayoutAlgorithm) => void
}

const layouts: Array<{
  id: LayoutAlgorithm
  label: string
  icon: React.ComponentType<{ className?: string }>
}> = [
  { id: 'force-directed', label: 'Force', icon: Network },
  { id: 'hierarchical', label: 'Tree', icon: GitBranch },
  { id: 'radial', label: 'Radial', icon: Circle },
]

export function LayoutSwitcher({ layout, onLayoutChange }: LayoutSwitcherProps) {
  return (
    <div
      className="bg-zinc-900/90 backdrop-blur-sm border border-zinc-700 rounded-lg p-1 shadow-xl flex"
      data-testid="layout-switcher"
    >
      {layouts.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          onClick={() => onLayoutChange?.(id)}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all ${
            layout === id
              ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
          }`}
          title={`${label} layout`}
          aria-label={`${label} layout`}
          aria-pressed={layout === id}
        >
          <Icon className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">{label}</span>
        </button>
      ))}
    </div>
  )
}
