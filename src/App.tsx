import { useEffect, useRef } from 'react'
import { AppShell } from '@/components/shell/AppShell'
import { GraphCanvas } from '@/components/graph/GraphCanvas'
import { useAppStore } from '@/stores/useAppStore'
import { useProjectActions } from '@/hooks/useProjectActions'
import type { GraphNode, GraphEdge, File } from '@/types'

// Sample data for development/demo
const sampleFiles: File[] = [
  { id: 'file-1', name: 'App.tsx', path: 'src/App.tsx', absolutePath: '/src/App.tsx', language: 'typescript', lineCount: 45, isHidden: false, projectId: 'demo' },
  { id: 'file-2', name: 'index.ts', path: 'src/index.ts', absolutePath: '/src/index.ts', language: 'typescript', lineCount: 12, isHidden: false, projectId: 'demo' },
  { id: 'file-3', name: 'utils.ts', path: 'src/utils.ts', absolutePath: '/src/utils.ts', language: 'typescript', lineCount: 89, isHidden: false, projectId: 'demo' },
  { id: 'file-4', name: 'types.ts', path: 'src/types.ts', absolutePath: '/src/types.ts', language: 'typescript', lineCount: 156, isHidden: false, projectId: 'demo' },
  { id: 'file-5', name: 'hooks.ts', path: 'src/hooks.ts', absolutePath: '/src/hooks.ts', language: 'typescript', lineCount: 78, isHidden: false, projectId: 'demo' },
  { id: 'file-6', name: 'store.ts', path: 'src/store.ts', absolutePath: '/src/store.ts', language: 'typescript', lineCount: 134, isHidden: false, projectId: 'demo' },
  { id: 'file-7', name: 'api.ts', path: 'src/api.ts', absolutePath: '/src/api.ts', language: 'typescript', lineCount: 67, isHidden: false, projectId: 'demo' },
  { id: 'file-8', name: 'config.ts', path: 'src/config.ts', absolutePath: '/src/config.ts', language: 'typescript', lineCount: 23, isHidden: false, projectId: 'demo' },
]

const sampleNodes: GraphNode[] = [
  { id: 'file-1', name: 'App.tsx', type: 'file', language: 'typescript', position: { x: 450, y: 300 }, connectionCount: 4, state: 'default', isExported: true },
  { id: 'file-2', name: 'index.ts', type: 'file', language: 'typescript', position: { x: 300, y: 150 }, connectionCount: 2, state: 'default', isExported: true },
  { id: 'file-3', name: 'utils.ts', type: 'file', language: 'typescript', position: { x: 600, y: 150 }, connectionCount: 3, state: 'default', isExported: true },
  { id: 'file-4', name: 'types.ts', type: 'file', language: 'typescript', position: { x: 750, y: 300 }, connectionCount: 5, state: 'default', isExported: true },
  { id: 'file-5', name: 'hooks.ts', type: 'file', language: 'typescript', position: { x: 600, y: 450 }, connectionCount: 2, state: 'default', isExported: true },
  { id: 'file-6', name: 'store.ts', type: 'file', language: 'typescript', position: { x: 300, y: 450 }, connectionCount: 3, state: 'default', isExported: true },
  { id: 'file-7', name: 'api.ts', type: 'file', language: 'typescript', position: { x: 150, y: 300 }, connectionCount: 2, state: 'default', isExported: true },
  { id: 'file-8', name: 'config.ts', type: 'file', language: 'typescript', position: { x: 450, y: 500 }, connectionCount: 1, state: 'default', isExported: true },
]

const sampleEdges: GraphEdge[] = [
  { id: 'edge-1', source: 'file-2', target: 'file-1', type: 'imports' },
  { id: 'edge-2', source: 'file-1', target: 'file-3', type: 'imports' },
  { id: 'edge-3', source: 'file-1', target: 'file-4', type: 'imports' },
  { id: 'edge-4', source: 'file-1', target: 'file-5', type: 'imports' },
  { id: 'edge-5', source: 'file-1', target: 'file-6', type: 'imports' },
  { id: 'edge-6', source: 'file-3', target: 'file-4', type: 'imports' },
  { id: 'edge-7', source: 'file-5', target: 'file-4', type: 'imports' },
  { id: 'edge-8', source: 'file-6', target: 'file-4', type: 'imports' },
  { id: 'edge-9', source: 'file-7', target: 'file-3', type: 'imports' },
  { id: 'edge-10', source: 'file-7', target: 'file-8', type: 'imports' },
  { id: 'edge-11', source: 'file-6', target: 'file-7', type: 'calls' },
]

function App() {
  const { setNodes, setEdges, setFiles, currentProject, files, viewMode } = useAppStore()
  const { refreshGraph } = useProjectActions()
  const previousViewModeRef = useRef(viewMode)

  // Initialize with sample data for demo
  useEffect(() => {
    // Only set sample data if no project is loaded
    if (!currentProject) {
      setNodes(sampleNodes)
      setEdges(sampleEdges)
      setFiles(sampleFiles)
    }
  }, [currentProject, setNodes, setEdges, setFiles])

  // Refresh graph when viewMode changes
  useEffect(() => {
    console.log('[App] viewMode effect - current:', viewMode, 'previous:', previousViewModeRef.current, 'project:', currentProject?.id)

    // Skip if viewMode hasn't actually changed or no project loaded
    if (previousViewModeRef.current === viewMode || !currentProject) {
      console.log('[App] Skipping refresh - no change or no project')
      return
    }

    previousViewModeRef.current = viewMode

    console.log('[App] Calling refreshGraph with viewMode:', viewMode)
    // Fetch graph data with the new viewMode
    refreshGraph(currentProject.id, { viewMode }).catch((err) => {
      console.error('Failed to refresh graph:', err)
    })
  }, [viewMode, currentProject, refreshGraph])

  return (
    <AppShell>
      <GraphCanvas files={files} />
    </AppShell>
  )
}

export default App
