import { useCallback, useState } from 'react'
import { useAppStore } from '@/stores/useAppStore'
import * as api from '@/lib/tauri'

/**
 * Hook for project management actions
 * Connects the Zustand store to Tauri backend
 */
export function useProjectActions() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const {
    setCurrentProject,
    addRecentProject,
    setFiles,
    setSymbols,
    setNodes,
    setEdges,
    setAnalysisProgress,
    clearAnalysisErrors,
    setAllFiles,
  } = useAppStore()

  // Default analysis progress state for resetting
  const defaultAnalysisProgress = {
    status: 'idle' as const,
    currentFile: null,
    filesProcessed: 0,
    totalFiles: 0,
    percentComplete: 0,
    errorMessage: null,
    statistics: { totalRelationships: 0, totalSymbols: 0, totalFiles: 0 },
  }

  /**
   * Open folder picker and load project
   */
  const openProject = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      // Pick a folder
      const path = await api.pickFolder()
      if (!path) {
        setIsLoading(false)
        return null
      }

      // Open project in backend
      const project = await api.openProject(path)
      setCurrentProject(project)
      addRecentProject(project)

      // Clear existing data and reset analysis state
      setFiles([])
      setSymbols([])
      setNodes([])
      setEdges([])
      clearAnalysisErrors()
      setAnalysisProgress(defaultAnalysisProgress)

      // Load ALL project files for the sidebar (async, non-blocking)
      api.listProjectFiles(project.id)
        .then(setAllFiles)
        .catch(err => console.error('Failed to load project files:', err))

      setIsLoading(false)
      return project
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to open project'
      setError(message)
      setIsLoading(false)
      throw err
    }
  }, [setCurrentProject, addRecentProject, setFiles, setSymbols, setNodes, setEdges, clearAnalysisErrors, setAnalysisProgress, setAllFiles])

  /**
   * Open project from a path (e.g., from drag-and-drop)
   */
  const openProjectFromPath = useCallback(async (path: string) => {
    setIsLoading(true)
    setError(null)

    try {
      const project = await api.openProject(path)
      setCurrentProject(project)
      addRecentProject(project)

      // Clear existing data and reset analysis state
      setFiles([])
      setSymbols([])
      setNodes([])
      setEdges([])
      clearAnalysisErrors()
      setAnalysisProgress(defaultAnalysisProgress)

      // Load ALL project files for the sidebar (async, non-blocking)
      api.listProjectFiles(project.id)
        .then(setAllFiles)
        .catch(err => console.error('Failed to load project files:', err))

      setIsLoading(false)
      return project
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to open project'
      setError(message)
      setIsLoading(false)
      throw err
    }
  }, [setCurrentProject, addRecentProject, setFiles, setSymbols, setNodes, setEdges, clearAnalysisErrors, setAnalysisProgress, setAllFiles])

  /**
   * Start analysis for current project
   * Analysis now runs in the background - this returns immediately after validation.
   * Graph data is fetched when the progress callback receives 'complete' status.
   */
  const analyzeProject = useCallback(async (projectId: string) => {
    setIsLoading(true)
    setError(null)
    clearAnalysisErrors()

    // Clear old graph immediately so user sees fresh state
    setNodes([])
    setEdges([])

    try {
      // This now returns immediately after validation - analysis runs in background
      await api.startAnalysis(projectId, (progress) => {
        setAnalysisProgress(progress)

        // When analysis completes, fetch the graph data
        if (progress.status === 'complete') {
          api.getGraphData(projectId)
            .then((graphData) => {
              setNodes(graphData.nodes)
              setEdges(graphData.edges)

              // Derive files from file-type nodes for the sidebar
              const fileNodes = graphData.nodes.filter(node => node.type === 'file')
              const files = fileNodes.map(node => ({
                id: node.id,
                name: node.name,
                path: node.path || '',
                absolutePath: node.path || '',
                language: (node.language || 'unknown') as import('@/types').Language,
                lineCount: node.lineCount || 0,
                isHidden: false,
                projectId: projectId,
              }))
              setFiles(files)

              setIsLoading(false)
            })
            .catch((err) => {
              const message = err instanceof Error ? err.message : 'Failed to load graph data'
              setError(message)
              setIsLoading(false)
            })
        } else if (progress.status === 'error') {
          setError(progress.errorMessage || 'Analysis failed')
          setIsLoading(false)
        } else if (progress.status === 'cancelled') {
          setIsLoading(false)
        }
      })
    } catch (err) {
      // This only catches immediate validation errors (project not found, etc.)
      const message = err instanceof Error ? err.message : 'Failed to start analysis'
      setError(message)
      setIsLoading(false)
      throw err
    }
  }, [setAnalysisProgress, setNodes, setEdges, setFiles, clearAnalysisErrors])

  /**
   * Cancel ongoing analysis
   */
  const cancelAnalysis = useCallback(async (projectId: string) => {
    try {
      await api.cancelAnalysis(projectId)
    } catch (err) {
      console.error('Failed to cancel analysis:', err)
    }
  }, [])

  /**
   * Refresh graph data (e.g., after filter change)
   */
  const refreshGraph = useCallback(async (projectId: string, filters?: Parameters<typeof api.getGraphData>[1]) => {
    console.log('[refreshGraph] Starting - projectId:', projectId, 'filters:', filters)
    setIsLoading(true)
    setError(null)

    try {
      const graphData = await api.getGraphData(projectId, filters)
      console.log('[refreshGraph] Received data - nodes:', graphData.nodes.length, 'edges:', graphData.edges.length)
      console.log('[refreshGraph] Node types:', [...new Set(graphData.nodes.map(n => n.type))])
      console.log('[refreshGraph] First node:', graphData.nodes[0])
      setNodes(graphData.nodes)
      setEdges(graphData.edges)

      // Derive files from file-type nodes for the sidebar
      const fileNodes = graphData.nodes.filter(node => node.type === 'file')
      const files = fileNodes.map(node => ({
        id: node.id,
        name: node.name,
        path: node.path || '',
        absolutePath: node.path || '',
        language: (node.language || 'unknown') as import('@/types').Language,
        lineCount: node.lineCount || 0,
        isHidden: false,
        projectId: projectId,
      }))
      setFiles(files)

      setIsLoading(false)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load graph'
      setError(message)
      setIsLoading(false)
      throw err
    }
  }, [setNodes, setEdges, setFiles])

  /**
   * Load recent projects from backend
   */
  const loadRecentProjects = useCallback(async () => {
    try {
      const projects = await api.listProjects()
      // Add each project to recent (store handles deduplication)
      projects.forEach((project) => {
        addRecentProject(project)
      })
      return projects
    } catch (err) {
      console.error('Failed to load recent projects:', err)
      return []
    }
  }, [addRecentProject])

  /**
   * Select a recent project
   */
  const selectProject = useCallback(async (project: Parameters<typeof setCurrentProject>[0]) => {
    if (!project) return

    setCurrentProject(project)

    // Clear existing data
    setFiles([])
    setSymbols([])
    setNodes([])
    setEdges([])
    setAllFiles([])

    // Load ALL project files for the sidebar (async, non-blocking)
    api.listProjectFiles(project.id)
      .then(setAllFiles)
      .catch(err => console.error('Failed to load project files:', err))

    // If project was analyzed, load graph data and set complete status
    if (project.lastAnalyzedAt) {
      try {
        const graphData = await api.getGraphData(project.id)
        setNodes(graphData.nodes)
        setEdges(graphData.edges)

        // Derive files from file-type nodes for the sidebar
        const fileNodes = graphData.nodes.filter(node => node.type === 'file')
        const files = fileNodes.map(node => ({
          id: node.id,
          name: node.name,
          path: node.path || '',
          absolutePath: node.path || '',
          language: (node.language || 'unknown') as import('@/types').Language,
          lineCount: node.lineCount || 0,
          isHidden: false,
          projectId: project.id,
        }))
        setFiles(files)

        // Set analysis progress to complete with stats
        setAnalysisProgress({
          status: 'complete',
          currentFile: null,
          filesProcessed: graphData.nodes.filter(n => n.type === 'file').length,
          totalFiles: graphData.nodes.filter(n => n.type === 'file').length,
          percentComplete: 100,
          errorMessage: null,
          statistics: {
            totalRelationships: graphData.edges.length,
            totalSymbols: graphData.nodes.filter(n => n.type === 'symbol').length,
            totalFiles: graphData.nodes.filter(n => n.type === 'file').length,
          },
        })
      } catch (err) {
        console.error('Failed to load graph for project:', err)
        // Reset to idle on error
        setAnalysisProgress(defaultAnalysisProgress)
      }
    } else {
      // Project not analyzed yet - reset to idle
      setAnalysisProgress(defaultAnalysisProgress)
    }
  }, [setCurrentProject, setFiles, setSymbols, setNodes, setEdges, setAnalysisProgress, setAllFiles])

  return {
    isLoading,
    error,
    openProject,
    openProjectFromPath,
    analyzeProject,
    cancelAnalysis,
    refreshGraph,
    loadRecentProjects,
    selectProject,
  }
}
