import { FileCode, FunctionSquare } from 'lucide-react'
import type { ViewMode } from '@/types'

interface ViewModeSwitcherProps {
  viewMode: ViewMode
  onViewModeChange?: (mode: ViewMode) => void
}

export function ViewModeSwitcher({ viewMode, onViewModeChange }: ViewModeSwitcherProps) {
  return (
    <div
      className="bg-zinc-900/90 backdrop-blur-sm border border-zinc-700 rounded-lg p-1 shadow-xl flex"
      data-testid="view-mode-switcher"
    >
      <button
        onClick={() => onViewModeChange?.('file')}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
          viewMode === 'file'
            ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30'
            : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
        }`}
        title="File view"
        aria-label="File view"
        aria-pressed={viewMode === 'file'}
      >
        <FileCode className="w-3.5 h-3.5" />
        <span>Files</span>
      </button>
      <button
        onClick={() => onViewModeChange?.('symbol')}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
          viewMode === 'symbol'
            ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30'
            : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
        }`}
        title="Symbol view"
        aria-label="Symbol view"
        aria-pressed={viewMode === 'symbol'}
      >
        <FunctionSquare className="w-3.5 h-3.5" />
        <span>Symbols</span>
      </button>
    </div>
  )
}
