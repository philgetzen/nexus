import { useMemo } from 'react'
import type { Language, SymbolKind } from '@/types'

interface GraphNodeProps {
  id: string
  x: number
  y: number
  state: 'default' | 'hover' | 'selected' | 'faded' | 'search-match'
  name: string
  type: 'file' | 'symbol'
  language?: Language
  symbolKind?: SymbolKind
  connectionCount: number
  onHover?: () => void
  onHoverEnd?: () => void
  onClick?: () => void
  onDoubleClick?: () => void
}

// Node colors by type
const typeColors: Record<string, { bg: string; border: string; text: string }> = {
  file: {
    bg: 'fill-violet-500/20',
    border: 'stroke-violet-500/50',
    text: 'fill-violet-300',
  },
  function: {
    bg: 'fill-cyan-500/20',
    border: 'stroke-cyan-500/50',
    text: 'fill-cyan-300',
  },
  method: {
    bg: 'fill-cyan-500/20',
    border: 'stroke-cyan-500/50',
    text: 'fill-cyan-300',
  },
  class: {
    bg: 'fill-amber-500/20',
    border: 'stroke-amber-500/50',
    text: 'fill-amber-300',
  },
  type: {
    bg: 'fill-emerald-500/20',
    border: 'stroke-emerald-500/50',
    text: 'fill-emerald-300',
  },
  interface: {
    bg: 'fill-emerald-500/20',
    border: 'stroke-emerald-500/50',
    text: 'fill-emerald-300',
  },
  enum: {
    bg: 'fill-blue-500/20',
    border: 'stroke-blue-500/50',
    text: 'fill-blue-300',
  },
  variable: {
    bg: 'fill-rose-500/20',
    border: 'stroke-rose-500/50',
    text: 'fill-rose-300',
  },
  constant: {
    bg: 'fill-rose-500/20',
    border: 'stroke-rose-500/50',
    text: 'fill-rose-300',
  },
}

// Language accent colors
const languageAccents: Partial<Record<Language, string>> = {
  typescript: 'stroke-blue-500',
  javascript: 'stroke-yellow-500',
  python: 'stroke-green-500',
  swift: 'stroke-orange-500',
  go: 'stroke-cyan-500',
  rust: 'stroke-orange-600',
}

export function GraphNode({
  id,
  x,
  y,
  state,
  name,
  type,
  language,
  symbolKind,
  connectionCount,
  onHover,
  onHoverEnd,
  onClick,
  onDoubleClick,
}: GraphNodeProps) {
  const nodeType = type === 'file' ? 'file' : symbolKind || 'function'
  const colors = typeColors[nodeType] || typeColors.file
  const languageAccent = language ? languageAccents[language] || 'stroke-zinc-400' : 'stroke-zinc-400'

  // Size based on connections (importance)
  const size = useMemo(() => {
    const baseSize = 40
    const scale = Math.min(1 + connectionCount * 0.1, 2)
    return baseSize * scale
  }, [connectionCount])

  // State-based styling
  const stateOpacity = {
    default: 1,
    hover: 1,
    selected: 1,
    faded: 0.3,
    'search-match': 1,
  }

  const scale = state === 'hover' || state === 'selected' || state === 'search-match' ? 1.1 : 1
  const isSearchMatch = state === 'search-match'

  // Truncate name for display
  const displayName = name.length > 12 ? name.slice(0, 10) + '...' : name

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    onClick?.()
  }

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    onDoubleClick?.()
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    // Prevent pan from starting when clicking on nodes
    e.stopPropagation()
  }

  return (
    <g
      transform={`translate(${x}, ${y}) scale(${scale})`}
      className="cursor-pointer"
      style={{ transition: 'transform 200ms ease-out, opacity 200ms ease-out' }}
      opacity={stateOpacity[state]}
      onMouseEnter={onHover}
      onMouseLeave={onHoverEnd}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onMouseDown={handleMouseDown}
      data-testid={`graph-node-${id}`}
    >
      {/* Outer glow for selected/search-match state */}
      {state === 'selected' && (
        <circle r={size / 2 + 8} className="fill-violet-500/20" />
      )}
      {isSearchMatch && (
        <circle r={size / 2 + 10} className="fill-yellow-500/30" />
      )}

      {/* Language accent ring */}
      <circle
        r={size / 2 + 3}
        fill="none"
        strokeWidth={2}
        className={
          state === 'selected'
            ? 'stroke-violet-500'
            : isSearchMatch
            ? 'stroke-yellow-500'
            : languageAccent
        }
        strokeOpacity={state === 'faded' ? 0.3 : 0.8}
      />

      {/* Main node circle */}
      <circle
        r={size / 2}
        className={colors.bg}
        stroke="currentColor"
        strokeWidth={state === 'selected' ? 2 : 1}
        strokeOpacity={state === 'faded' ? 0.2 : 0.5}
      />

      {/* Node icon/indicator */}
      <g className={colors.text}>
        {type === 'file' ? (
          // File icon
          <path
            d="M-6,-8 L2,-8 L6,-4 L6,8 L-6,8 Z M2,-8 L2,-4 L6,-4"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : nodeType === 'function' || nodeType === 'method' ? (
          // Function icon (fn)
          <text
            textAnchor="middle"
            dominantBaseline="central"
            className="text-sm font-mono font-bold"
            fill="currentColor"
          >
            fn
          </text>
        ) : nodeType === 'class' ? (
          // Class icon (C)
          <text
            textAnchor="middle"
            dominantBaseline="central"
            className="text-sm font-bold"
            fill="currentColor"
          >
            C
          </text>
        ) : nodeType === 'interface' ? (
          // Interface icon (I)
          <text
            textAnchor="middle"
            dominantBaseline="central"
            className="text-sm font-bold"
            fill="currentColor"
          >
            I
          </text>
        ) : nodeType === 'enum' ? (
          // Enum icon (E)
          <text
            textAnchor="middle"
            dominantBaseline="central"
            className="text-sm font-bold"
            fill="currentColor"
          >
            E
          </text>
        ) : (
          // Type icon (T)
          <text
            textAnchor="middle"
            dominantBaseline="central"
            className="text-sm font-bold"
            fill="currentColor"
          >
            T
          </text>
        )}
      </g>

      {/* Node label */}
      <text
        y={size / 2 + 14}
        textAnchor="middle"
        className="text-xs font-medium fill-zinc-400"
        opacity={state === 'faded' ? 0.3 : 1}
      >
        {displayName}
      </text>
    </g>
  )
}
