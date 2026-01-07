import { Settings, PanelLeft, PanelRight } from 'lucide-react'
import { useAppStore } from '@/stores/useAppStore'
import { ProjectSelector } from '@/components/browser'
import { SearchBar } from '@/components/search'

interface ToolbarProps {
  onOpenSettings?: () => void
}

export function Toolbar({ onOpenSettings }: ToolbarProps) {
  const { panels, toggleSidebar, toggleInspector } = useAppStore()

  return (
    <header className="h-12 flex items-center px-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950">
      {/* Left: Sidebar toggle and project selector */}
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
        <ProjectSelector />
      </div>

      {/* Center: Search bar and controls */}
      <div className="flex-1 flex items-center justify-center gap-2">
        <SearchBar />
        <button
          onClick={onOpenSettings}
          className="p-1.5 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md transition-colors"
          title="Settings"
          aria-label="Settings"
        >
          <Settings className="w-4 h-4" />
        </button>
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

      {/* Right spacer to balance the layout */}
      <div className="w-40" />
    </header>
  )
}
