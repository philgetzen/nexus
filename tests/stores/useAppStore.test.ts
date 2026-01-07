import { describe, it, expect, beforeEach } from 'vitest'
import { useAppStore } from '@/stores/useAppStore'

describe('useAppStore', () => {
  beforeEach(() => {
    // Reset store state before each test
    useAppStore.setState({
      panels: {
        sidebarOpen: true,
        inspectorOpen: true,
        analysisPanelOpen: false,
        analysisPanelHeight: 200,
      },
      searchQuery: '',
      isSearchFocused: false,
      zoomLevel: 100,
      layoutAlgorithm: 'force-directed',
      viewMode: 'file',
      currentProject: null,
      recentProjects: [],
      files: [],
      symbols: [],
      nodes: [],
      edges: [],
      selectedNodeId: null,
      hoveredNodeId: null,
      filterState: {
        languages: [],
        nodeTypes: ['file', 'symbol'],
        relationshipTypes: ['imports', 'exports', 'calls', 'extends', 'implements', 'references', 'contains'],
        clusters: [],
      },
      savedFilters: [],
      analysisProgress: {
        status: 'idle',
        currentFile: null,
        filesProcessed: 0,
        totalFiles: 0,
        percentComplete: 0,
        estimatedTimeRemaining: null,
        statistics: {
          totalRelationships: 0,
          byType: {
            imports: 0,
            exports: 0,
            calls: 0,
            extends: 0,
            implements: 0,
            references: 0,
            contains: 0,
          },
        },
      },
      analysisErrors: [],
      ignorePatterns: ['node_modules', '.git', 'dist', 'build', '.next', '__pycache__'],
    })
  })

  describe('UI Slice', () => {
    it('should toggle sidebar', () => {
      const { toggleSidebar, panels } = useAppStore.getState()
      expect(panels.sidebarOpen).toBe(true)

      toggleSidebar()
      expect(useAppStore.getState().panels.sidebarOpen).toBe(false)

      toggleSidebar()
      expect(useAppStore.getState().panels.sidebarOpen).toBe(true)
    })

    it('should toggle inspector', () => {
      const { toggleInspector, panels } = useAppStore.getState()
      expect(panels.inspectorOpen).toBe(true)

      toggleInspector()
      expect(useAppStore.getState().panels.inspectorOpen).toBe(false)

      toggleInspector()
      expect(useAppStore.getState().panels.inspectorOpen).toBe(true)
    })

    it('should toggle analysis panel', () => {
      const { toggleAnalysisPanel, panels } = useAppStore.getState()
      expect(panels.analysisPanelOpen).toBe(false)

      toggleAnalysisPanel()
      expect(useAppStore.getState().panels.analysisPanelOpen).toBe(true)
    })

    it('should update search query', () => {
      const { setSearchQuery } = useAppStore.getState()
      expect(useAppStore.getState().searchQuery).toBe('')

      setSearchQuery('test query')
      expect(useAppStore.getState().searchQuery).toBe('test query')
    })

    it('should clamp zoom level between 10 and 400', () => {
      const { setZoomLevel } = useAppStore.getState()

      setZoomLevel(500)
      expect(useAppStore.getState().zoomLevel).toBe(400)

      setZoomLevel(5)
      expect(useAppStore.getState().zoomLevel).toBe(10)

      setZoomLevel(150)
      expect(useAppStore.getState().zoomLevel).toBe(150)
    })

    it('should update layout algorithm', () => {
      const { setLayoutAlgorithm } = useAppStore.getState()

      setLayoutAlgorithm('hierarchical')
      expect(useAppStore.getState().layoutAlgorithm).toBe('hierarchical')
    })

    it('should update view mode', () => {
      const { setViewMode } = useAppStore.getState()

      setViewMode('symbol')
      expect(useAppStore.getState().viewMode).toBe('symbol')
    })
  })

  describe('Project Slice', () => {
    const mockProject = {
      id: 'project-1',
      name: 'Test Project',
      path: '/path/to/project',
      createdAt: '2024-01-01T00:00:00Z',
      lastAnalyzedAt: '2024-01-01T00:00:00Z',
      isFavorite: false,
    }

    it('should set current project', () => {
      const { setCurrentProject } = useAppStore.getState()

      setCurrentProject(mockProject)
      expect(useAppStore.getState().currentProject).toEqual(mockProject)

      setCurrentProject(null)
      expect(useAppStore.getState().currentProject).toBeNull()
    })

    it('should add recent project and limit to 10', () => {
      const { addRecentProject } = useAppStore.getState()

      // Add 12 projects
      for (let i = 0; i < 12; i++) {
        addRecentProject({ ...mockProject, id: `project-${i}`, name: `Project ${i}` })
      }

      const { recentProjects } = useAppStore.getState()
      expect(recentProjects).toHaveLength(10)
      // Most recent should be first
      expect(recentProjects[0].name).toBe('Project 11')
    })

    it('should not duplicate projects in recent list', () => {
      const { addRecentProject } = useAppStore.getState()

      addRecentProject(mockProject)
      addRecentProject(mockProject)

      expect(useAppStore.getState().recentProjects).toHaveLength(1)
    })

    it('should toggle favorite status', () => {
      const { addRecentProject, toggleFavorite, setCurrentProject } = useAppStore.getState()

      addRecentProject(mockProject)
      setCurrentProject(mockProject)

      toggleFavorite('project-1')

      const state = useAppStore.getState()
      expect(state.recentProjects[0].isFavorite).toBe(true)
      expect(state.currentProject?.isFavorite).toBe(true)
    })
  })

  describe('Graph Slice', () => {
    it('should select and deselect nodes', () => {
      const { selectNode } = useAppStore.getState()

      selectNode('node-1')
      expect(useAppStore.getState().selectedNodeId).toBe('node-1')

      selectNode(null)
      expect(useAppStore.getState().selectedNodeId).toBeNull()
    })

    it('should hover and unhover nodes', () => {
      const { hoverNode } = useAppStore.getState()

      hoverNode('node-1')
      expect(useAppStore.getState().hoveredNodeId).toBe('node-1')

      hoverNode(null)
      expect(useAppStore.getState().hoveredNodeId).toBeNull()
    })

    it('should save and delete filters', () => {
      const { saveFilter, deleteFilter } = useAppStore.getState()

      const filter = {
        id: 'filter-1',
        name: 'My Filter',
        filter: {
          languages: ['typescript' as const],
          nodeTypes: ['file' as const],
          relationshipTypes: ['imports' as const],
          clusters: [],
        },
      }

      saveFilter(filter)
      expect(useAppStore.getState().savedFilters).toHaveLength(1)

      deleteFilter('filter-1')
      expect(useAppStore.getState().savedFilters).toHaveLength(0)
    })
  })

  describe('Analysis Slice', () => {
    it('should add and clear analysis errors', () => {
      const { addAnalysisError, clearAnalysisErrors } = useAppStore.getState()

      const error = {
        id: 'error-1',
        filePath: '/path/to/file.ts',
        message: 'Parse error',
        severity: 'error' as const,
        timestamp: '2024-01-01T00:00:00Z',
      }

      addAnalysisError(error)
      expect(useAppStore.getState().analysisErrors).toHaveLength(1)

      clearAnalysisErrors()
      expect(useAppStore.getState().analysisErrors).toHaveLength(0)
    })

    it('should manage ignore patterns', () => {
      const { addIgnorePattern, removeIgnorePattern, ignorePatterns } = useAppStore.getState()

      // Default patterns should exist
      expect(ignorePatterns).toContain('node_modules')

      // Add new pattern
      addIgnorePattern('*.log')
      expect(useAppStore.getState().ignorePatterns).toContain('*.log')

      // Should not duplicate
      addIgnorePattern('node_modules')
      expect(useAppStore.getState().ignorePatterns.filter((p) => p === 'node_modules')).toHaveLength(1)

      // Remove pattern
      removeIgnorePattern('*.log')
      expect(useAppStore.getState().ignorePatterns).not.toContain('*.log')
    })
  })
})
