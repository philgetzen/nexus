import { useState, useCallback } from 'react'
import { Toolbar } from './Toolbar'
import { Sidebar } from './Sidebar'
import { Inspector } from './Inspector'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import { useProjectActions } from '@/hooks/useProjectActions'
import { useAppStore } from '@/stores/useAppStore'
import { DropZone, AnalysisPanel, ContextMenu } from '@/components/browser'
import * as api from '@/lib/tauri'

interface AppShellProps {
  children?: React.ReactNode
}

interface ContextMenuState {
  isOpen: boolean
  x: number
  y: number
  nodeId?: string
  nodePath?: string
  nodeType?: 'file' | 'symbol'
}

export function AppShell({ children }: AppShellProps) {
  // Enable keyboard shortcuts
  useKeyboardShortcuts()

  const { openProjectFromPath, refreshGraph } = useProjectActions()
  const { currentProject, panels, toggleAnalysisPanel } = useAppStore()

  // Context menu state
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    isOpen: false,
    x: 0,
    y: 0,
  })

  const handleDrop = useCallback(
    async (path: string) => {
      try {
        const project = await openProjectFromPath(path)
        if (project) {
          toggleAnalysisPanel() // Open analysis panel after loading project
        }
      } catch (err) {
        console.error('Failed to open project:', err)
      }
    },
    [openProjectFromPath, toggleAnalysisPanel]
  )

  const handleAnalyze = useCallback(async () => {
    if (!panels.analysisPanelOpen) {
      toggleAnalysisPanel()
    }
  }, [panels.analysisPanelOpen, toggleAnalysisPanel])

  const handleContextMenu = useCallback(
    (e: React.MouseEvent, nodeId: string, path: string) => {
      setContextMenu({
        isOpen: true,
        x: e.clientX,
        y: e.clientY,
        nodeId,
        nodePath: path,
        nodeType: 'file',
      })
    },
    []
  )

  const handleCloseContextMenu = useCallback(() => {
    setContextMenu((prev) => ({ ...prev, isOpen: false }))
  }, [])

  const handleHideFromGraph = useCallback(
    async (nodeId: string) => {
      try {
        await api.setFileVisibility(nodeId, true)
        // Refresh the graph to reflect the change
        if (currentProject) {
          await refreshGraph(currentProject.id)
        }
      } catch (err) {
        console.error('Failed to hide file from graph:', err)
      }
    },
    [currentProject, refreshGraph]
  )

  return (
    <DropZone onDrop={handleDrop}>
      <div className="h-screen flex flex-col bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
        {/* Toolbar */}
        <Toolbar onAnalyze={handleAnalyze} />

        {/* Main content area */}
        <div className="flex-1 flex overflow-hidden">
          {/* Sidebar */}
          <Sidebar onContextMenu={handleContextMenu} />

          {/* Graph canvas area with analysis panel */}
          <div className="flex-1 min-w-[400px] flex flex-col overflow-hidden">
            {/* Main canvas */}
            <main className="flex-1 relative overflow-hidden bg-zinc-100 dark:bg-zinc-900">
              {children || (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center text-zinc-400">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center">
                      <svg
                        className="w-8 h-8"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.5}
                          d="M13 10V3L4 14h7v7l9-11h-7z"
                        />
                      </svg>
                    </div>
                    <h2 className="text-lg font-medium mb-1">Welcome to Nexus</h2>
                    <p className="text-sm">Drag a project folder here to visualize your codebase</p>
                    <p className="text-xs mt-4 text-zinc-500">
                      Or use{' '}
                      <kbd className="px-1.5 py-0.5 bg-zinc-200 dark:bg-zinc-700 rounded text-xs">
                        ⌘O
                      </kbd>{' '}
                      to open a folder
                    </p>
                  </div>
                </div>
              )}
            </main>

            {/* Analysis panel */}
            <AnalysisPanel onClose={toggleAnalysisPanel} />
          </div>

          {/* Inspector */}
          <Inspector />
        </div>

        {/* Context menu */}
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          isOpen={contextMenu.isOpen}
          onClose={handleCloseContextMenu}
          nodeId={contextMenu.nodeId}
          nodePath={contextMenu.nodePath}
          nodeType={contextMenu.nodeType}
          onHideFromGraph={handleHideFromGraph}
        />
      </div>
    </DropZone>
  )
}
