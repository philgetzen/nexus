import { create } from 'zustand'
import type {
  Project,
  File,
  Symbol,
  GraphNode,
  GraphEdge,
  AnalysisProgress,
  AnalysisError,
  FilterState,
  SavedFilter,
  LayoutAlgorithm,
  ViewMode,
  PanelState,
} from '@/types'

// =============================================================================
// UI Slice
// =============================================================================

interface UISlice {
  // Panel state
  panels: PanelState
  toggleSidebar: () => void
  toggleInspector: () => void
  toggleAnalysisPanel: () => void
  setAnalysisPanelHeight: (height: number) => void

  // Search
  searchQuery: string
  setSearchQuery: (query: string) => void
  isSearchFocused: boolean
  setSearchFocused: (focused: boolean) => void

  // Graph view
  zoomLevel: number
  setZoomLevel: (level: number) => void
  layoutAlgorithm: LayoutAlgorithm
  setLayoutAlgorithm: (algorithm: LayoutAlgorithm) => void
  viewMode: ViewMode
  setViewMode: (mode: ViewMode) => void
}

// =============================================================================
// Project Slice
// =============================================================================

interface ProjectSlice {
  // Current project
  currentProject: Project | null
  setCurrentProject: (project: Project | null) => void

  // Recent projects
  recentProjects: Project[]
  addRecentProject: (project: Project) => void
  removeRecentProject: (projectId: string) => void
  toggleFavorite: (projectId: string) => void

  // Files and symbols
  files: File[]
  symbols: Symbol[]
  setFiles: (files: File[]) => void
  setSymbols: (symbols: Symbol[]) => void
}

// =============================================================================
// Graph Slice
// =============================================================================

interface GraphSlice {
  // Graph data
  nodes: GraphNode[]
  edges: GraphEdge[]
  setNodes: (nodes: GraphNode[]) => void
  setEdges: (edges: GraphEdge[]) => void

  // Selection
  selectedNodeId: string | null
  hoveredNodeId: string | null
  selectNode: (nodeId: string | null) => void
  hoverNode: (nodeId: string | null) => void

  // Filtering
  filterState: FilterState
  setFilterState: (filter: FilterState) => void
  savedFilters: SavedFilter[]
  saveFilter: (filter: SavedFilter) => void
  deleteFilter: (filterId: string) => void
}

// =============================================================================
// Analysis Slice
// =============================================================================

interface AnalysisSlice {
  // Progress tracking
  analysisProgress: AnalysisProgress
  setAnalysisProgress: (progress: AnalysisProgress) => void

  // Errors
  analysisErrors: AnalysisError[]
  addAnalysisError: (error: AnalysisError) => void
  clearAnalysisErrors: () => void

  // Ignore patterns
  ignorePatterns: string[]
  addIgnorePattern: (pattern: string) => void
  removeIgnorePattern: (pattern: string) => void
}

// =============================================================================
// Combined Store
// =============================================================================

type AppStore = UISlice & ProjectSlice & GraphSlice & AnalysisSlice

const defaultFilterState: FilterState = {
  viewMode: 'file',
  languages: [],
  nodeTypes: ['file', 'symbol'],
  relationshipTypes: ['imports', 'exports', 'calls', 'extends', 'implements', 'references', 'contains'],
  symbolKinds: [],
  clusters: [],
  searchQuery: null,
}

const defaultAnalysisProgress: AnalysisProgress = {
  status: 'idle',
  currentFile: null,
  filesProcessed: 0,
  totalFiles: 0,
  percentComplete: 0,
  errorMessage: null,
  statistics: {
    totalRelationships: 0,
    totalSymbols: 0,
    totalFiles: 0,
  },
}

export const useAppStore = create<AppStore>((set) => ({
  // =========================================================================
  // UI Slice
  // =========================================================================
  panels: {
    sidebarOpen: true,
    inspectorOpen: true,
    analysisPanelOpen: false,
    analysisPanelHeight: 200,
  },
  toggleSidebar: () =>
    set((state) => ({
      panels: { ...state.panels, sidebarOpen: !state.panels.sidebarOpen },
    })),
  toggleInspector: () =>
    set((state) => ({
      panels: { ...state.panels, inspectorOpen: !state.panels.inspectorOpen },
    })),
  toggleAnalysisPanel: () =>
    set((state) => ({
      panels: { ...state.panels, analysisPanelOpen: !state.panels.analysisPanelOpen },
    })),
  setAnalysisPanelHeight: (height) =>
    set((state) => ({
      panels: { ...state.panels, analysisPanelHeight: height },
    })),

  searchQuery: '',
  setSearchQuery: (query) => set({ searchQuery: query }),
  isSearchFocused: false,
  setSearchFocused: (focused) => set({ isSearchFocused: focused }),

  zoomLevel: 100,
  setZoomLevel: (level) => set({ zoomLevel: Math.max(10, Math.min(400, level)) }),
  layoutAlgorithm: 'force-directed',
  setLayoutAlgorithm: (algorithm) => set({ layoutAlgorithm: algorithm }),
  viewMode: 'file',
  setViewMode: (mode) => set({ viewMode: mode }),

  // =========================================================================
  // Project Slice
  // =========================================================================
  currentProject: null,
  setCurrentProject: (project) => set({ currentProject: project }),

  recentProjects: [],
  addRecentProject: (project) =>
    set((state) => {
      const filtered = state.recentProjects.filter((p) => p.id !== project.id)
      return { recentProjects: [project, ...filtered].slice(0, 10) }
    }),
  removeRecentProject: (projectId) =>
    set((state) => ({
      recentProjects: state.recentProjects.filter((p) => p.id !== projectId),
    })),
  toggleFavorite: (projectId) =>
    set((state) => ({
      recentProjects: state.recentProjects.map((p) =>
        p.id === projectId ? { ...p, isFavorite: !p.isFavorite } : p
      ),
      currentProject:
        state.currentProject?.id === projectId
          ? { ...state.currentProject, isFavorite: !state.currentProject.isFavorite }
          : state.currentProject,
    })),

  files: [],
  symbols: [],
  setFiles: (files) => set({ files }),
  setSymbols: (symbols) => set({ symbols }),

  // =========================================================================
  // Graph Slice
  // =========================================================================
  nodes: [],
  edges: [],
  setNodes: (nodes) => set({ nodes }),
  setEdges: (edges) => set({ edges }),

  selectedNodeId: null,
  hoveredNodeId: null,
  selectNode: (nodeId) => set({ selectedNodeId: nodeId }),
  hoverNode: (nodeId) => set({ hoveredNodeId: nodeId }),

  filterState: defaultFilterState,
  setFilterState: (filter) => set({ filterState: filter }),
  savedFilters: [],
  saveFilter: (filter) =>
    set((state) => ({
      savedFilters: [...state.savedFilters.filter((f) => f.id !== filter.id), filter],
    })),
  deleteFilter: (filterId) =>
    set((state) => ({
      savedFilters: state.savedFilters.filter((f) => f.id !== filterId),
    })),

  // =========================================================================
  // Analysis Slice
  // =========================================================================
  analysisProgress: defaultAnalysisProgress,
  setAnalysisProgress: (progress) => set({ analysisProgress: progress }),

  analysisErrors: [],
  addAnalysisError: (error) =>
    set((state) => ({
      analysisErrors: [...state.analysisErrors, error],
    })),
  clearAnalysisErrors: () => set({ analysisErrors: [] }),

  ignorePatterns: ['node_modules', '.git', 'dist', 'build', '.next', '__pycache__'],
  addIgnorePattern: (pattern) =>
    set((state) => ({
      ignorePatterns: state.ignorePatterns.includes(pattern)
        ? state.ignorePatterns
        : [...state.ignorePatterns, pattern],
    })),
  removeIgnorePattern: (pattern) =>
    set((state) => ({
      ignorePatterns: state.ignorePatterns.filter((p) => p !== pattern),
    })),
}))
