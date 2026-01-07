/**
 * Tauri API bindings for communicating with the Rust backend
 */
import { invoke, Channel } from '@tauri-apps/api/core'
import { open } from '@tauri-apps/plugin-dialog'
import { open as shellOpen, Command } from '@tauri-apps/plugin-shell'
import type {
  Project,
  File,
  Symbol,
  GraphNode,
  GraphEdge,
  AnalysisProgress,
  FilterState,
} from '@/types'

// =============================================================================
// Type Definitions (matching Rust backend)
// =============================================================================

export interface GraphData {
  nodes: GraphNode[]
  edges: GraphEdge[]
}

export interface NodeDetails {
  id: string
  nodeType: 'file' | 'symbol' | 'unknown'
  file: File | null
  symbol: Symbol | null
  containingFile: File | null
  symbolsInFile: Symbol[] | null
  incomingRelationships: Relationship[]
  outgoingRelationships: Relationship[]
}

export interface Relationship {
  id: string
  sourceId: string
  targetId: string
  kind: string
  metadata: string | null
}

export interface AppInfo {
  name: string
  version: string
}

// =============================================================================
// Project Commands
// =============================================================================

/**
 * Open a project directory
 */
export async function openProject(path: string): Promise<Project> {
  return invoke<Project>('open_project', { path })
}

/**
 * List all projects
 */
export async function listProjects(): Promise<Project[]> {
  return invoke<Project[]>('list_projects')
}

/**
 * Get a specific project by ID
 */
export async function getProject(id: string): Promise<Project | null> {
  return invoke<Project | null>('get_project', { id })
}

/**
 * Delete a project
 */
export async function deleteProject(id: string): Promise<void> {
  return invoke<void>('delete_project', { id })
}

// =============================================================================
// Project File Browser Commands
// =============================================================================

/**
 * File type classification
 */
export type FileType = 'code' | 'image' | 'font' | 'config' | 'document' | 'other'

/**
 * A project file entry (ALL files, not just code)
 */
export interface ProjectFile {
  id: string
  name: string
  path: string
  absolutePath: string
  fileType: FileType
  size: number
}

/**
 * List ALL files in a project directory (not just code files)
 * Used for the sidebar file browser
 */
export async function listProjectFiles(projectId: string): Promise<ProjectFile[]> {
  return invoke<ProjectFile[]>('list_project_files', { projectId })
}

// =============================================================================
// Analysis Commands
// =============================================================================

/**
 * Start analyzing a project with progress streaming
 * @param projectId The project to analyze
 * @param onProgress Callback for progress updates
 */
export async function startAnalysis(
  projectId: string,
  onProgress: (progress: AnalysisProgress) => void
): Promise<void> {
  // Create a channel for receiving progress updates
  const channel = new Channel<AnalysisProgress>()

  // Set up message handler
  channel.onmessage = (progress) => {
    onProgress(progress)
  }

  // Start analysis with the channel
  await invoke('start_analysis', { projectId, channel })
}

/**
 * Cancel an ongoing analysis
 */
export async function cancelAnalysis(projectId: string): Promise<void> {
  return invoke<void>('cancel_analysis', { projectId })
}

// =============================================================================
// Graph Commands
// =============================================================================

/**
 * Get graph data for a project
 */
export async function getGraphData(
  projectId: string,
  filters?: Partial<FilterState>
): Promise<GraphData> {
  return invoke<GraphData>('get_graph_data', { projectId, filters })
}

/**
 * Get details for a specific node
 */
export async function getNodeDetails(nodeId: string): Promise<NodeDetails> {
  return invoke<NodeDetails>('get_node_details', { nodeId })
}

/**
 * Hide or show a file from the graph
 */
export async function setFileVisibility(fileId: string, isHidden: boolean): Promise<boolean> {
  return invoke<boolean>('set_file_visibility', { fileId, isHidden })
}

// =============================================================================
// Utility Commands
// =============================================================================

/**
 * Get application info
 */
export async function getAppInfo(): Promise<AppInfo> {
  return invoke<AppInfo>('get_app_info')
}

/**
 * Simple greeting (for testing IPC)
 */
export async function greet(name: string): Promise<string> {
  return invoke<string>('greet', { name })
}

// =============================================================================
// Dialog Helpers
// =============================================================================

/**
 * Open a folder picker dialog
 */
export async function pickFolder(): Promise<string | null> {
  const result = await open({
    directory: true,
    multiple: false,
    title: 'Select a project folder',
  })
  return result as string | null
}

// =============================================================================
// Shell Helpers
// =============================================================================

/**
 * Open a file in the default editor
 */
export async function openInEditor(path: string, editor: string = 'code'): Promise<void> {
  const command = Command.create(editor, [path])
  await command.execute()
}

/**
 * Reveal a file in Finder
 */
export async function revealInFinder(path: string): Promise<void> {
  const command = Command.create('open', ['-R', path])
  await command.execute()
}

/**
 * Open a URL in the default browser
 */
export async function openUrl(url: string): Promise<void> {
  await shellOpen(url)
}
