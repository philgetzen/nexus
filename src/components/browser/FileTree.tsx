import { useState, useMemo, useCallback } from 'react'
import {
  ChevronRight,
  ChevronDown,
  Folder,
  FolderOpen,
  FileCode,
  FileJson,
  FileText,
  File as FileIcon,
  EyeOff,
} from 'lucide-react'
import { useAppStore } from '@/stores/useAppStore'
import type { File, Language, GraphNode } from '@/types'

// =============================================================================
// Types
// =============================================================================

interface TreeNode {
  name: string
  path: string
  isDirectory: boolean
  children: TreeNode[]
  file?: File
  graphNode?: GraphNode
}

interface FileTreeProps {
  onNodeSelect?: (nodeId: string) => void
  onNodeDoubleClick?: (nodeId: string, path: string) => void
  onContextMenu?: (e: React.MouseEvent, nodeId: string, path: string) => void
}

// =============================================================================
// Helpers
// =============================================================================

/**
 * Build a tree structure from a flat list of files
 */
function buildTree(files: File[], nodes: GraphNode[]): TreeNode[] {
  const root: Map<string, TreeNode> = new Map()
  const nodeMap = new Map(nodes.map((n) => [n.id, n]))

  for (const file of files) {
    const parts = file.path.split('/')
    let currentLevel = root

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]
      const isLast = i === parts.length - 1
      const currentPath = parts.slice(0, i + 1).join('/')

      if (!currentLevel.has(part)) {
        const node: TreeNode = {
          name: part,
          path: currentPath,
          isDirectory: !isLast,
          children: [],
          file: isLast ? file : undefined,
          graphNode: isLast ? nodeMap.get(file.id) : undefined,
        }
        currentLevel.set(part, node)
      }

      const existingNode = currentLevel.get(part)!
      if (!isLast) {
        // Convert children array to map for next level
        if (!existingNode.children.length) {
          const childMap = new Map<string, TreeNode>()
          currentLevel = childMap
          // Store reference to update later
          ;(existingNode as any)._childMap = childMap
        } else {
          currentLevel = (existingNode as any)._childMap || new Map()
        }
      }
    }
  }

  // Convert map structure to sorted arrays
  function convertToArray(map: Map<string, TreeNode>): TreeNode[] {
    return Array.from(map.values())
      .map((node) => ({
        ...node,
        children: (node as any)._childMap
          ? convertToArray((node as any)._childMap)
          : [],
      }))
      .sort((a, b) => {
        // Directories first, then alphabetically
        if (a.isDirectory !== b.isDirectory) {
          return a.isDirectory ? -1 : 1
        }
        return a.name.localeCompare(b.name)
      })
  }

  return convertToArray(root)
}

/**
 * Get icon component for a language
 */
function getLanguageIcon(language: Language): React.ReactNode {
  switch (language) {
    case 'typescript':
    case 'javascript':
    case 'swift':
    case 'python':
    case 'go':
    case 'rust':
    case 'java':
    case 'kotlin':
    case 'c':
    case 'cpp':
    case 'csharp':
    case 'ruby':
    case 'php':
      return <FileCode className="w-4 h-4 text-blue-500" />
    case 'json':
      return <FileJson className="w-4 h-4 text-yellow-500" />
    case 'markdown':
      return <FileText className="w-4 h-4 text-zinc-500" />
    case 'yaml':
      return <FileText className="w-4 h-4 text-purple-500" />
    default:
      return <FileIcon className="w-4 h-4 text-zinc-400" />
  }
}

// =============================================================================
// FileTreeNode Component
// =============================================================================

interface FileTreeNodeProps {
  node: TreeNode
  depth: number
  selectedId: string | null
  expandedPaths: Set<string>
  onToggle: (path: string) => void
  onSelect: (nodeId: string) => void
  onDoubleClick: (nodeId: string, path: string) => void
  onContextMenu: (e: React.MouseEvent, nodeId: string, path: string) => void
}

function FileTreeNode({
  node,
  depth,
  selectedId,
  expandedPaths,
  onToggle,
  onSelect,
  onDoubleClick,
  onContextMenu,
}: FileTreeNodeProps) {
  const isExpanded = expandedPaths.has(node.path)
  const isSelected = node.file?.id === selectedId
  const isHidden = node.file?.isHidden || false

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (node.isDirectory) {
      onToggle(node.path)
    } else if (node.file) {
      onSelect(node.file.id)
    }
  }

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!node.isDirectory && node.file) {
      onDoubleClick(node.file.id, node.file.absolutePath)
    }
  }

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (node.file) {
      onContextMenu(e, node.file.id, node.file.absolutePath)
    }
  }

  return (
    <div>
      <button
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        onContextMenu={handleContextMenu}
        className={`w-full flex items-center gap-1 px-2 py-1 text-sm text-left transition-colors ${
          isSelected
            ? 'bg-violet-100 dark:bg-violet-900/30 text-violet-900 dark:text-violet-100'
            : 'hover:bg-zinc-100 dark:hover:bg-zinc-800'
        } ${isHidden ? 'opacity-50' : ''}`}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
      >
        {/* Expand/collapse icon */}
        {node.isDirectory ? (
          <span className="flex-shrink-0">
            {isExpanded ? (
              <ChevronDown className="w-4 h-4 text-zinc-400" />
            ) : (
              <ChevronRight className="w-4 h-4 text-zinc-400" />
            )}
          </span>
        ) : (
          <span className="w-4" />
        )}

        {/* Icon */}
        <span className="flex-shrink-0">
          {node.isDirectory ? (
            isExpanded ? (
              <FolderOpen className="w-4 h-4 text-amber-500" />
            ) : (
              <Folder className="w-4 h-4 text-amber-500" />
            )
          ) : (
            node.file && getLanguageIcon(node.file.language)
          )}
        </span>

        {/* Name */}
        <span className="flex-1 truncate">{node.name}</span>

        {/* Hidden indicator */}
        {isHidden && <EyeOff className="w-3 h-3 text-zinc-400 flex-shrink-0" />}

        {/* Line count for files */}
        {!node.isDirectory && node.file && (
          <span className="text-xs text-zinc-400 flex-shrink-0">
            {node.file.lineCount}L
          </span>
        )}
      </button>

      {/* Children */}
      {node.isDirectory && isExpanded && node.children.length > 0 && (
        <div>
          {node.children.map((child) => (
            <FileTreeNode
              key={child.path}
              node={child}
              depth={depth + 1}
              selectedId={selectedId}
              expandedPaths={expandedPaths}
              onToggle={onToggle}
              onSelect={onSelect}
              onDoubleClick={onDoubleClick}
              onContextMenu={onContextMenu}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// =============================================================================
// FileTree Component
// =============================================================================

export function FileTree({
  onNodeSelect,
  onNodeDoubleClick,
  onContextMenu,
}: FileTreeProps) {
  const { files, nodes, selectedNodeId, selectNode, currentProject } = useAppStore()
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set())
  const [searchFilter, setSearchFilter] = useState('')

  // Build tree structure from files
  const tree = useMemo(() => buildTree(files, nodes), [files, nodes])

  // Filter tree by search
  const filteredTree = useMemo(() => {
    if (!searchFilter.trim()) return tree

    const filterNode = (node: TreeNode): TreeNode | null => {
      // Check if this node matches
      const nameMatches = node.name.toLowerCase().includes(searchFilter.toLowerCase())

      // Filter children
      const filteredChildren = node.children
        .map(filterNode)
        .filter((n): n is TreeNode => n !== null)

      // Include if matches or has matching children
      if (nameMatches || filteredChildren.length > 0) {
        return { ...node, children: filteredChildren }
      }

      return null
    }

    return tree.map(filterNode).filter((n): n is TreeNode => n !== null)
  }, [tree, searchFilter])

  const handleToggle = useCallback((path: string) => {
    setExpandedPaths((prev) => {
      const next = new Set(prev)
      if (next.has(path)) {
        next.delete(path)
      } else {
        next.add(path)
      }
      return next
    })
  }, [])

  const handleSelect = useCallback(
    (nodeId: string) => {
      selectNode(nodeId)
      onNodeSelect?.(nodeId)
    },
    [selectNode, onNodeSelect]
  )

  const handleDoubleClick = useCallback(
    (nodeId: string, path: string) => {
      onNodeDoubleClick?.(nodeId, path)
    },
    [onNodeDoubleClick]
  )

  const handleContextMenu = useCallback(
    (e: React.MouseEvent, nodeId: string, path: string) => {
      onContextMenu?.(e, nodeId, path)
    },
    [onContextMenu]
  )

  // Expand all directories on initial load
  const expandAll = useCallback(() => {
    const allPaths = new Set<string>()
    const collectPaths = (nodes: TreeNode[]) => {
      for (const node of nodes) {
        if (node.isDirectory) {
          allPaths.add(node.path)
          collectPaths(node.children)
        }
      }
    }
    collectPaths(tree)
    setExpandedPaths(allPaths)
  }, [tree])

  const collapseAll = useCallback(() => {
    setExpandedPaths(new Set())
  }, [])

  if (!currentProject) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-4 text-center">
        <Folder className="w-12 h-12 text-zinc-300 dark:text-zinc-600 mb-3" />
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          No project open
        </p>
        <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1">
          Open a folder to view files
        </p>
      </div>
    )
  }

  if (files.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-4 text-center">
        <FileCode className="w-12 h-12 text-zinc-300 dark:text-zinc-600 mb-3" />
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          No files analyzed
        </p>
        <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1">
          Run analysis to see the file tree
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Search and controls */}
      <div className="flex items-center gap-2 p-2 border-b border-zinc-200 dark:border-zinc-700">
        <input
          type="text"
          value={searchFilter}
          onChange={(e) => setSearchFilter(e.target.value)}
          placeholder="Filter files..."
          className="flex-1 px-2 py-1 text-sm bg-zinc-100 dark:bg-zinc-800 rounded border-none focus:outline-none focus:ring-1 focus:ring-violet-500"
        />
        <button
          onClick={expandAll}
          className="p-1 text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors"
          title="Expand all"
        >
          <ChevronDown className="w-4 h-4" />
        </button>
        <button
          onClick={collapseAll}
          className="p-1 text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors"
          title="Collapse all"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Tree */}
      <div className="flex-1 overflow-auto">
        {filteredTree.length > 0 ? (
          filteredTree.map((node) => (
            <FileTreeNode
              key={node.path}
              node={node}
              depth={0}
              selectedId={selectedNodeId}
              expandedPaths={expandedPaths}
              onToggle={handleToggle}
              onSelect={handleSelect}
              onDoubleClick={handleDoubleClick}
              onContextMenu={handleContextMenu}
            />
          ))
        ) : (
          <div className="p-4 text-center text-sm text-zinc-500">
            No matching files
          </div>
        )}
      </div>

      {/* Footer with stats */}
      <div className="px-3 py-2 text-xs text-zinc-500 border-t border-zinc-200 dark:border-zinc-700">
        {files.length} files
      </div>
    </div>
  )
}
