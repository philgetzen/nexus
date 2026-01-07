import { useState, useRef, useEffect } from 'react'
import {
  ChevronDown,
  FolderOpen,
  Folder,
  Star,
  StarOff,
  Clock,
  Plus,
  Trash2,
  RefreshCw,
} from 'lucide-react'
import { useAppStore } from '@/stores/useAppStore'
import { useProjectActions } from '@/hooks/useProjectActions'
import type { Project } from '@/types'

interface ProjectSelectorProps {
  onAnalyze?: () => void
}

export function ProjectSelector({ onAnalyze }: ProjectSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const {
    currentProject,
    recentProjects,
    toggleFavorite,
    removeRecentProject,
  } = useAppStore()

  const {
    isLoading,
    openProject,
    selectProject,
    loadRecentProjects,
  } = useProjectActions()

  // Load recent projects on mount
  useEffect(() => {
    loadRecentProjects()
  }, [loadRecentProjects])

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const favorites = recentProjects.filter((p) => p.isFavorite)
  const recent = recentProjects.filter((p) => !p.isFavorite)

  const handleOpenProject = async () => {
    setIsOpen(false)
    const project = await openProject()
    if (project && onAnalyze) {
      onAnalyze()
    }
  }

  const handleSelectProject = async (project: Project) => {
    setIsOpen(false)
    await selectProject(project)
  }

  const handleToggleFavorite = (e: React.MouseEvent, projectId: string) => {
    e.stopPropagation()
    toggleFavorite(projectId)
  }

  const handleRemoveProject = (e: React.MouseEvent, projectId: string) => {
    e.stopPropagation()
    removeRecentProject(projectId)
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={isLoading}
        className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-md transition-colors min-w-[160px] max-w-[240px]"
      >
        {currentProject ? (
          <>
            <Folder className="w-4 h-4 text-violet-500 flex-shrink-0" />
            <span className="truncate">{currentProject.name}</span>
          </>
        ) : (
          <>
            <FolderOpen className="w-4 h-4 text-zinc-400 flex-shrink-0" />
            <span className="text-zinc-500">Open Project</span>
          </>
        )}
        <ChevronDown
          className={`w-4 h-4 text-zinc-400 flex-shrink-0 transition-transform ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {/* Dropdown menu */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-72 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-lg overflow-hidden z-50">
          {/* Open new project */}
          <button
            onClick={handleOpenProject}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors border-b border-zinc-200 dark:border-zinc-700"
          >
            <Plus className="w-4 h-4 text-violet-500" />
            <span>Open Folder...</span>
          </button>

          {/* Favorites section */}
          {favorites.length > 0 && (
            <div className="py-1">
              <div className="px-3 py-1.5 text-xs font-medium text-zinc-500 uppercase tracking-wider flex items-center gap-1">
                <Star className="w-3 h-3" />
                Favorites
              </div>
              {favorites.map((project) => (
                <ProjectItem
                  key={project.id}
                  project={project}
                  isActive={currentProject?.id === project.id}
                  onSelect={() => handleSelectProject(project)}
                  onToggleFavorite={(e) => handleToggleFavorite(e, project.id)}
                  onRemove={(e) => handleRemoveProject(e, project.id)}
                />
              ))}
            </div>
          )}

          {/* Recent section */}
          {recent.length > 0 && (
            <div className="py-1 border-t border-zinc-200 dark:border-zinc-700">
              <div className="px-3 py-1.5 text-xs font-medium text-zinc-500 uppercase tracking-wider flex items-center gap-1">
                <Clock className="w-3 h-3" />
                Recent
              </div>
              {recent.slice(0, 5).map((project) => (
                <ProjectItem
                  key={project.id}
                  project={project}
                  isActive={currentProject?.id === project.id}
                  onSelect={() => handleSelectProject(project)}
                  onToggleFavorite={(e) => handleToggleFavorite(e, project.id)}
                  onRemove={(e) => handleRemoveProject(e, project.id)}
                />
              ))}
            </div>
          )}

          {/* Empty state */}
          {recentProjects.length === 0 && (
            <div className="px-3 py-6 text-center">
              <Folder className="w-8 h-8 mx-auto mb-2 text-zinc-300 dark:text-zinc-600" />
              <p className="text-sm text-zinc-500">No recent projects</p>
              <p className="text-xs text-zinc-400 mt-1">Click "Open Folder" to get started</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

interface ProjectItemProps {
  project: Project
  isActive: boolean
  onSelect: () => void
  onToggleFavorite: (e: React.MouseEvent) => void
  onRemove: (e: React.MouseEvent) => void
}

function ProjectItem({
  project,
  isActive,
  onSelect,
  onToggleFavorite,
  onRemove,
}: ProjectItemProps) {
  const [showActions, setShowActions] = useState(false)

  return (
    <button
      onClick={onSelect}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
      className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors ${
        isActive
          ? 'bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-300'
          : 'hover:bg-zinc-50 dark:hover:bg-zinc-800'
      }`}
    >
      <Folder
        className={`w-4 h-4 flex-shrink-0 ${
          isActive ? 'text-violet-500' : project.isFavorite ? 'text-amber-500' : 'text-zinc-400'
        }`}
      />
      <div className="flex-1 min-w-0">
        <div className="truncate font-medium">{project.name}</div>
        <div className="truncate text-xs text-zinc-400 font-mono">{project.path}</div>
      </div>

      {/* Action buttons */}
      {showActions && (
        <div className="flex items-center gap-1">
          <button
            onClick={onToggleFavorite}
            className="p-1 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded transition-colors"
            title={project.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
          >
            {project.isFavorite ? (
              <StarOff className="w-3.5 h-3.5 text-amber-500" />
            ) : (
              <Star className="w-3.5 h-3.5 text-zinc-400" />
            )}
          </button>
          <button
            onClick={onRemove}
            className="p-1 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded transition-colors"
            title="Remove from recent"
          >
            <Trash2 className="w-3.5 h-3.5 text-zinc-400 hover:text-red-500" />
          </button>
        </div>
      )}

      {/* Last analyzed indicator */}
      {!showActions && project.lastAnalyzedAt && (
        <span title="Analyzed">
          <RefreshCw className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
        </span>
      )}
    </button>
  )
}
