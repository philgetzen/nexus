import { useState } from 'react'
import { X, Star, Clock, Folder, RefreshCw, Loader2, ChevronDown, ChevronRight, Filter, RotateCcw } from 'lucide-react'
import { useAppStore } from '@/stores/useAppStore'
import { FileTree } from '@/components/browser'
import { useProjectActions } from '@/hooks/useProjectActions'
import * as api from '@/lib/tauri'
import type { Language } from '@/types'

const LANGUAGE_OPTIONS: { value: Language; label: string; color: string }[] = [
  { value: 'typescript', label: 'TS', color: 'bg-blue-500' },
  { value: 'javascript', label: 'JS', color: 'bg-yellow-500' },
  { value: 'swift', label: 'Swift', color: 'bg-orange-500' },
  { value: 'python', label: 'Python', color: 'bg-green-500' },
  { value: 'go', label: 'Go', color: 'bg-cyan-500' },
  { value: 'rust', label: 'Rust', color: 'bg-orange-600' },
  { value: 'json', label: 'JSON', color: 'bg-zinc-500' },
  { value: 'markdown', label: 'MD', color: 'bg-zinc-400' },
]

interface SidebarProps {
  onContextMenu?: (e: React.MouseEvent, nodeId: string, path: string) => void
}

export function Sidebar({ onContextMenu }: SidebarProps) {
  const [filtersExpanded, setFiltersExpanded] = useState(false)

  const {
    panels,
    toggleSidebar,
    currentProject,
    recentProjects,
    selectNode,
    analysisProgress,
    filterState,
    setFilterState,
  } = useAppStore()

  const { selectProject, analyzeProject, cancelAnalysis } = useProjectActions()

  const isAnalyzing = analysisProgress.status === 'analyzing'
  const isComplete = analysisProgress.status === 'complete'

  const toggleLanguage = (language: Language) => {
    const current = filterState.languages
    const next = current.includes(language)
      ? current.filter((l) => l !== language)
      : [...current, language]
    setFilterState({ ...filterState, languages: next })
  }

  const resetFilters = () => {
    setFilterState({
      ...filterState,
      languages: [],
      symbolKinds: [],
    })
  }

  const activeFilterCount = filterState.languages.length + filterState.symbolKinds.length

  if (!panels.sidebarOpen) return null

  const favorites = recentProjects.filter((p) => p.isFavorite)
  const recent = recentProjects.filter((p) => !p.isFavorite).slice(0, 3)

  const handleNodeSelect = (nodeId: string) => {
    selectNode(nodeId)
  }

  const handleNodeDoubleClick = async (_nodeId: string, path: string) => {
    try {
      await api.openInEditor(path)
    } catch (err) {
      console.error('Failed to open file in editor:', err)
    }
  }

  const handleSelectProject = async (project: typeof recentProjects[0]) => {
    await selectProject(project)
  }

  return (
    <aside className="w-60 flex-shrink-0 border-r border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 flex flex-col overflow-hidden">
      {/* Project header */}
      <div className="p-3 border-b border-zinc-200 dark:border-zinc-800">
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <h2 className="font-medium text-sm truncate">
              {currentProject?.name || 'No Project'}
            </h2>
            <p className="text-xs text-zinc-500 truncate font-mono">
              {currentProject?.path || 'Open a folder to start'}
            </p>
          </div>
          <button
            onClick={toggleSidebar}
            className="p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 lg:hidden"
            aria-label="Close sidebar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Analyze button with progress */}
        {currentProject && (
          <div className="mt-3">
            {isAnalyzing ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-500">Analyzing...</span>
                  <button
                    onClick={() => cancelAnalysis(currentProject.id)}
                    className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                  >
                    Cancel
                  </button>
                </div>
                <div className="w-full h-1.5 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-violet-500 transition-all duration-300"
                    style={{ width: `${analysisProgress.percentComplete}%` }}
                  />
                </div>
                <p className="text-[10px] text-zinc-400 truncate">
                  {analysisProgress.currentFile || 'Starting...'}
                </p>
              </div>
            ) : (
              <button
                onClick={() => analyzeProject(currentProject.id)}
                className={`w-full flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  isComplete
                    ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                    : 'bg-violet-500 text-white hover:bg-violet-600'
                }`}
              >
                {isComplete ? (
                  <>
                    <RefreshCw className="w-4 h-4" />
                    Re-analyze
                  </>
                ) : (
                  <>
                    <Loader2 className="w-4 h-4" />
                    Analyze Project
                  </>
                )}
              </button>
            )}
          </div>
        )}
      </div>

      {/* File tree - takes most of the space */}
      <div className="flex-1 overflow-hidden">
        <FileTree
          onNodeSelect={handleNodeSelect}
          onNodeDoubleClick={handleNodeDoubleClick}
          onContextMenu={onContextMenu}
        />
      </div>

      {/* Filters section */}
      {currentProject && (
        <div className="border-t border-zinc-200 dark:border-zinc-800">
          <button
            onClick={() => setFiltersExpanded(!filtersExpanded)}
            className="w-full flex items-center justify-between px-3 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <div className="flex items-center gap-1.5">
              {filtersExpanded ? (
                <ChevronDown className="w-3 h-3 text-zinc-400" />
              ) : (
                <ChevronRight className="w-3 h-3 text-zinc-400" />
              )}
              <Filter className="w-3 h-3 text-zinc-500" />
              <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Filters</span>
            </div>
            {activeFilterCount > 0 && (
              <span className="text-[10px] bg-violet-500 text-white px-1.5 py-0.5 rounded-full">
                {activeFilterCount}
              </span>
            )}
          </button>
          {filtersExpanded && (
            <div className="px-3 pb-3 space-y-2">
              {/* Language filter pills */}
              <div className="flex flex-wrap gap-1">
                {LANGUAGE_OPTIONS.map((lang) => (
                  <button
                    key={lang.value}
                    onClick={() => toggleLanguage(lang.value)}
                    className={`px-2 py-0.5 text-[10px] font-medium rounded transition-colors ${
                      filterState.languages.includes(lang.value)
                        ? 'bg-violet-500 text-white'
                        : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
                    }`}
                  >
                    <span className={`inline-block w-1.5 h-1.5 rounded-full ${lang.color} mr-1`} />
                    {lang.label}
                  </button>
                ))}
              </div>
              {/* Reset button */}
              {activeFilterCount > 0 && (
                <button
                  onClick={resetFilters}
                  className="flex items-center gap-1 text-[10px] text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                >
                  <RotateCcw className="w-3 h-3" />
                  Clear filters
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Favorites */}
      {favorites.length > 0 && (
        <div className="border-t border-zinc-200 dark:border-zinc-800 py-2">
          <div className="px-3 mb-2">
            <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wider flex items-center gap-1.5">
              <Star className="w-3 h-3" />
              Favorites
            </h3>
          </div>
          <div>
            {favorites.map((project) => (
              <button
                key={project.id}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                onClick={() => handleSelectProject(project)}
              >
                <Folder className="w-4 h-4 text-violet-500 flex-shrink-0" />
                <span className="truncate text-zinc-600 dark:text-zinc-400">{project.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Recent projects */}
      {recent.length > 0 && (
        <div className="border-t border-zinc-200 dark:border-zinc-800 py-2">
          <div className="px-3 mb-2">
            <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wider flex items-center gap-1.5">
              <Clock className="w-3 h-3" />
              Recent
            </h3>
          </div>
          <div>
            {recent.map((project) => (
              <button
                key={project.id}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                onClick={() => handleSelectProject(project)}
              >
                <Folder className="w-4 h-4 text-zinc-400 flex-shrink-0" />
                <span className="truncate text-zinc-600 dark:text-zinc-400">{project.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </aside>
  )
}
