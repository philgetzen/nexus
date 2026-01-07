import { useState, useRef, useEffect } from 'react'
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  Filter,
  Settings,
  PanelLeft,
  PanelRight,
  BarChart3,
  Loader2,
} from 'lucide-react'
import { useAppStore } from '@/stores/useAppStore'
import { ProjectSelector } from '@/components/browser'
import { SearchBar, FilterPanel, SavedFilters } from '@/components/search'

interface ToolbarProps {
  onOpenSettings?: () => void
  onAnalyze?: () => void
}

export function Toolbar({ onOpenSettings, onAnalyze }: ToolbarProps) {
  const filterButtonRef = useRef<HTMLButtonElement>(null)
  const [isFilterOpen, setIsFilterOpen] = useState(false)

  const {
    panels,
    toggleSidebar,
    toggleInspector,
    toggleAnalysisPanel,
    zoomLevel,
    setZoomLevel,
    filterState,
    analysisProgress,
  } = useAppStore()

  const isAnalyzing = analysisProgress.status === 'analyzing'

  // Close filter panel when clicking outside
  useEffect(() => {
    if (!isFilterOpen) return

    const handleClickOutside = (e: MouseEvent) => {
      if (
        filterButtonRef.current &&
        !filterButtonRef.current.contains(e.target as Node)
      ) {
        // Check if clicking inside the filter panel
        const filterPanel = document.querySelector('[data-filter-panel]')
        if (filterPanel && filterPanel.contains(e.target as Node)) {
          return
        }
        setIsFilterOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isFilterOpen])

  const handleZoomIn = () => setZoomLevel(zoomLevel + 25)
  const handleZoomOut = () => setZoomLevel(zoomLevel - 25)
  const handleZoomFit = () => setZoomLevel(100)

  // Count active filters
  const activeFilterCount =
    filterState.languages.length +
    filterState.symbolKinds.length +
    (filterState.relationshipTypes.length < 7
      ? 7 - filterState.relationshipTypes.length
      : 0)

  return (
    <header className="h-12 flex items-center px-4 gap-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950">
      {/* Left: Logo, sidebar toggle, and project selector */}
      <div className="flex items-center gap-2">
        <button
          onClick={toggleSidebar}
          className={`p-1.5 rounded-md transition-colors ${
            panels.sidebarOpen
              ? 'bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400'
              : 'text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800'
          }`}
          title="Toggle sidebar (⌘1)"
          aria-label="Toggle sidebar"
        >
          <PanelLeft className="w-4 h-4" />
        </button>
        <span className="font-semibold text-sm tracking-tight">Nexus</span>
        <div className="w-px h-4 bg-zinc-300 dark:bg-zinc-700 mx-1" />
        <ProjectSelector onAnalyze={onAnalyze} />
      </div>

      {/* Center: Search bar */}
      <SearchBar />

      {/* Right: Controls */}
      <div className="flex items-center gap-1">
        {/* Saved filters */}
        <SavedFilters />

        {/* Zoom controls */}
        <div className="flex items-center border border-zinc-200 dark:border-zinc-700 rounded-md overflow-hidden">
          <button
            onClick={handleZoomOut}
            className="p-1.5 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            title="Zoom out"
            aria-label="Zoom out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <span className="px-2 text-xs text-zinc-500 font-medium min-w-[3rem] text-center">
            {zoomLevel}%
          </span>
          <button
            onClick={handleZoomFit}
            className="p-1.5 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors border-x border-zinc-200 dark:border-zinc-700"
            title="Fit to view"
            aria-label="Fit to view"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
          <button
            onClick={handleZoomIn}
            className="p-1.5 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            title="Zoom in"
            aria-label="Zoom in"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
        </div>

        {/* Analysis panel toggle with inline progress */}
        <div className="flex items-center gap-1.5">
          {isAnalyzing && (
            <div className="flex items-center gap-1.5 px-2 py-1 bg-violet-50 dark:bg-violet-900/20 rounded-md">
              <Loader2 className="w-3.5 h-3.5 text-violet-500 animate-spin" />
              <span className="text-xs font-medium text-violet-600 dark:text-violet-400">
                {Math.round(analysisProgress.percentComplete)}%
              </span>
              <div className="w-16 h-1.5 bg-violet-200 dark:bg-violet-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-violet-500 transition-all duration-300"
                  style={{ width: `${analysisProgress.percentComplete}%` }}
                />
              </div>
            </div>
          )}
          <button
            onClick={toggleAnalysisPanel}
            className={`p-1.5 rounded-md transition-colors ${
              panels.analysisPanelOpen || isAnalyzing
                ? 'bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400'
                : 'text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800'
            }`}
            title="Toggle analysis panel"
            aria-label="Toggle analysis panel"
          >
            <BarChart3 className="w-4 h-4" />
          </button>
        </div>

        {/* Filter toggle */}
        <div className="relative">
          <button
            ref={filterButtonRef}
            onClick={() => setIsFilterOpen(!isFilterOpen)}
            className={`p-1.5 rounded-md transition-colors relative ${
              isFilterOpen || activeFilterCount > 0
                ? 'bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400'
                : 'text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800'
            }`}
            title="Filter"
            aria-label="Filter"
          >
            <Filter className="w-4 h-4" />
            {activeFilterCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 text-[10px] font-medium bg-violet-500 text-white rounded-full flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
          </button>
          <div data-filter-panel>
            <FilterPanel isOpen={isFilterOpen} onClose={() => setIsFilterOpen(false)} />
          </div>
        </div>

        {/* Settings */}
        <button
          onClick={onOpenSettings}
          className="p-1.5 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md transition-colors"
          title="Settings"
          aria-label="Settings"
        >
          <Settings className="w-4 h-4" />
        </button>

        {/* Inspector toggle */}
        <button
          onClick={toggleInspector}
          className={`p-1.5 rounded-md transition-colors ${
            panels.inspectorOpen
              ? 'bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400'
              : 'text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800'
          }`}
          title="Toggle inspector (⌘2)"
          aria-label="Toggle inspector"
        >
          <PanelRight className="w-4 h-4" />
        </button>
      </div>
    </header>
  )
}
