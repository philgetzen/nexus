import { X, Star, Clock, Folder } from 'lucide-react'
import { useAppStore } from '@/stores/useAppStore'
import { FileTree } from '@/components/browser'
import { useProjectActions } from '@/hooks/useProjectActions'
import * as api from '@/lib/tauri'

interface SidebarProps {
  onContextMenu?: (e: React.MouseEvent, nodeId: string, path: string) => void
}

export function Sidebar({ onContextMenu }: SidebarProps) {
  const {
    panels,
    toggleSidebar,
    currentProject,
    recentProjects,
    selectNode,
  } = useAppStore()

  const { selectProject } = useProjectActions()

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
      </div>

      {/* File tree - takes most of the space */}
      <div className="flex-1 overflow-hidden">
        <FileTree
          onNodeSelect={handleNodeSelect}
          onNodeDoubleClick={handleNodeDoubleClick}
          onContextMenu={onContextMenu}
        />
      </div>

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
