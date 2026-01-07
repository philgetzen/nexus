// =============================================================================
// Nexus Data Model Types
// =============================================================================

/**
 * A codebase folder opened for analysis.
 * The root container that holds all files, symbols, and relationships.
 */
export interface Project {
  /** Unique identifier for the project */
  id: string
  /** Name of the project (folder name) */
  name: string
  /** Absolute path to the project folder */
  path: string
  /** When the project was first opened */
  createdAt: string
  /** When the project was last analyzed */
  lastAnalyzedAt: string
  /** Whether this project is pinned as a favorite */
  isFavorite: boolean
}

/**
 * A source code file within a project.
 * Primary nodes in the graph at file-level view.
 */
export interface File {
  /** Unique identifier for the file */
  id: string
  /** File name without path */
  name: string
  /** Path relative to project root */
  path: string
  /** Absolute path to the file */
  absolutePath: string
  /** Programming language (swift, typescript, python, etc.) */
  language: Language
  /** Number of lines in the file */
  lineCount: number
  /** Whether this file is hidden from the graph */
  isHidden: boolean
  /** ID of the project this file belongs to */
  projectId: string
}

/**
 * A code entity extracted from a file.
 * Detailed nodes when zoomed into symbol-level view.
 */
export interface Symbol {
  /** Unique identifier for the symbol */
  id: string
  /** Name of the symbol (function name, class name, etc.) */
  name: string
  /** Type of symbol */
  kind: SymbolKind
  /** Line number where the symbol is defined */
  line: number
  /** Column number where the symbol starts */
  column: number
  /** ID of the file containing this symbol */
  fileId: string
  /** Whether this symbol is exported/public */
  isExported: boolean
}

/**
 * A directional connection between two symbols or files.
 * Represents imports, function calls, type references, etc.
 */
export interface Relationship {
  /** Unique identifier for the relationship */
  id: string
  /** ID of the source node (file or symbol) */
  sourceId: string
  /** ID of the target node (file or symbol) */
  targetId: string
  /** Type of relationship */
  kind: RelationshipKind
  /** Whether this is a file-level or symbol-level relationship */
  level: 'file' | 'symbol'
}

/**
 * A logical grouping of related files or symbols.
 * Used for high-level architecture visualization.
 */
export interface Cluster {
  /** Unique identifier for the cluster */
  id: string
  /** Display name for the cluster */
  name: string
  /** How the cluster was created */
  source: 'auto' | 'manual'
  /** Color for visual identification */
  color: string
  /** IDs of files in this cluster */
  fileIds: string[]
  /** IDs of symbols in this cluster */
  symbolIds: string[]
}

// =============================================================================
// Enums and Union Types
// =============================================================================

/**
 * Supported programming languages
 */
export type Language =
  // Full parsing support
  | 'swift'
  | 'typescript'
  | 'javascript'
  | 'python'
  | 'go'
  | 'rust'
  | 'c'
  // Discovery-only (included in graph but no symbol extraction)
  | 'json'
  | 'yaml'
  | 'markdown'
  | 'html'
  | 'css'
  | 'plist'
  | 'shell'
  // Legacy/placeholder (kept for compatibility)
  | 'java'
  | 'kotlin'
  | 'cpp'
  | 'csharp'
  | 'ruby'
  | 'php'
  | 'unknown'

/**
 * Types of code symbols
 */
export type SymbolKind =
  | 'function'
  | 'class'
  | 'interface'
  | 'type'
  | 'enum'
  | 'variable'
  | 'constant'
  | 'method'
  | 'property'
  | 'module'
  | 'namespace'

/**
 * Types of relationships between nodes
 */
export type RelationshipKind =
  | 'imports'
  | 'exports'
  | 'calls'
  | 'extends'
  | 'implements'
  | 'references'
  | 'contains'

// =============================================================================
// Graph Visualization Types
// =============================================================================

/**
 * Visual state for graph nodes
 * - default: Normal display
 * - hover: Mouse is over the node
 * - selected: Node is currently selected
 * - faded: Node is dimmed (not connected to selected or search match)
 * - search-match: Node matches the current search query
 */
export type NodeState = 'default' | 'hover' | 'selected' | 'faded' | 'search-match'

/**
 * A node in the graph visualization - aligned with Rust backend
 */
export interface GraphNode {
  /** Unique identifier (same as File.id or Symbol.id) */
  id: string
  /** Display name */
  name: string
  /** Type of node */
  type: 'file' | 'symbol'
  /** Programming language (for file nodes) */
  language?: Language
  /** Symbol kind (for symbol nodes) */
  symbolKind?: SymbolKind
  /** File path (for file nodes) */
  path?: string
  /** Line number (for symbol nodes) */
  line?: number
  /** Line count (for file nodes) */
  lineCount?: number
  /** Whether this symbol is exported/public */
  isExported: boolean
  /** Number of connections (for sizing) */
  connectionCount: number
  /** Visual state - provided by backend, can be overridden by frontend */
  state: NodeState
  /** Position on canvas - calculated by frontend */
  position?: { x: number; y: number }
}

/**
 * An edge in the graph visualization
 */
export interface GraphEdge {
  /** Unique identifier */
  id: string
  /** Source node ID */
  source: string
  /** Target node ID */
  target: string
  /** Type of relationship */
  type: RelationshipKind
}

// =============================================================================
// Analysis Types
// =============================================================================

/**
 * Status of the code analysis process - aligned with Rust backend
 */
export interface AnalysisProgress {
  /** Current analysis state */
  status: 'idle' | 'analyzing' | 'complete' | 'error' | 'cancelled'
  /** File currently being analyzed */
  currentFile: string | null
  /** Number of files processed */
  filesProcessed: number
  /** Total files to process */
  totalFiles: number
  /** Percentage complete (0-100) */
  percentComplete: number
  /** Error message if status is 'error' */
  errorMessage: string | null
  /** Analysis statistics */
  statistics: AnalysisStatistics
}

/**
 * Statistics from the analysis - aligned with Rust backend
 */
export interface AnalysisStatistics {
  /** Total relationships found */
  totalRelationships: number
  /** Total symbols found */
  totalSymbols: number
  /** Total files analyzed */
  totalFiles: number
}

/**
 * An error encountered during analysis
 */
export interface AnalysisError {
  /** Unique identifier */
  id: string
  /** Path to the file that failed */
  filePath: string
  /** Error message */
  message: string
  /** Severity level */
  severity: 'error' | 'warning'
  /** When the error occurred */
  timestamp: string
}

// =============================================================================
// Filter Types
// =============================================================================

/**
 * Current filter state for the graph - aligned with Rust backend
 */
export interface FilterState {
  /** View mode: file or symbol level */
  viewMode: ViewMode
  /** Languages to show (empty = all) */
  languages: Language[]
  /** Node types to show */
  nodeTypes: ('file' | 'symbol')[]
  /** Relationship types to show */
  relationshipTypes: RelationshipKind[]
  /** Symbol kinds to filter by */
  symbolKinds: SymbolKind[]
  /** Clusters to show (empty = all) */
  clusters: string[]
  /** Search query for filtering nodes by name */
  searchQuery: string | null
}

/**
 * A saved filter configuration
 */
export interface SavedFilter {
  /** Unique identifier */
  id: string
  /** User-defined name */
  name: string
  /** The filter configuration */
  filter: FilterState
}

// =============================================================================
// UI State Types
// =============================================================================

/**
 * Layout algorithm for the graph
 */
export type LayoutAlgorithm = 'force-directed' | 'hierarchical' | 'radial'

/**
 * View mode for the graph
 */
export type ViewMode = 'file' | 'symbol'

/**
 * Application panel visibility state
 */
export interface PanelState {
  sidebarOpen: boolean
  inspectorOpen: boolean
}
