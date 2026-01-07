import { useEffect, useRef, useCallback } from 'react'
import {
  ExternalLink,
  FolderOpen,
  Copy,
  EyeOff,
  Trash2,
  RefreshCw,
  Focus,
} from 'lucide-react'
import * as api from '@/lib/tauri'

export interface ContextMenuProps {
  x: number
  y: number
  isOpen: boolean
  onClose: () => void
  // Node context
  nodeId?: string
  nodePath?: string
  nodeType?: 'file' | 'symbol'
  // Actions
  onHideFromGraph?: (nodeId: string) => void
  onFocusNode?: (nodeId: string) => void
  onDeleteNode?: (nodeId: string) => void
  onRefreshNode?: (nodeId: string) => void
}

interface MenuItemProps {
  icon: React.ReactNode
  label: string
  onClick: () => void
  shortcut?: string
  variant?: 'default' | 'danger'
  disabled?: boolean
}

function MenuItem({ icon, label, onClick, shortcut, variant = 'default', disabled = false }: MenuItemProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-full flex items-center gap-2 px-3 py-1.5 text-sm text-left transition-colors ${
        disabled
          ? 'text-zinc-400 cursor-not-allowed'
          : variant === 'danger'
            ? 'text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20'
            : 'text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700'
      }`}
    >
      <span className="flex-shrink-0">{icon}</span>
      <span className="flex-1">{label}</span>
      {shortcut && (
        <span className="text-xs text-zinc-400 font-mono">{shortcut}</span>
      )}
    </button>
  )
}

function MenuDivider() {
  return <div className="my-1 h-px bg-zinc-200 dark:bg-zinc-700" />
}

export function ContextMenu({
  x,
  y,
  isOpen,
  onClose,
  nodeId,
  nodePath,
  nodeType: _nodeType,
  onHideFromGraph,
  onFocusNode,
  onDeleteNode,
  onRefreshNode,
}: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)

  // Adjust position to keep menu in viewport
  const getAdjustedPosition = useCallback(() => {
    if (!menuRef.current) return { x, y }

    const menuRect = menuRef.current.getBoundingClientRect()
    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight

    let adjustedX = x
    let adjustedY = y

    // Prevent overflow on right side
    if (x + menuRect.width > viewportWidth) {
      adjustedX = viewportWidth - menuRect.width - 8
    }

    // Prevent overflow on bottom
    if (y + menuRect.height > viewportHeight) {
      adjustedY = viewportHeight - menuRect.height - 8
    }

    // Prevent negative positions
    adjustedX = Math.max(8, adjustedX)
    adjustedY = Math.max(8, adjustedY)

    return { x: adjustedX, y: adjustedY }
  }, [x, y])

  // Close on escape or click outside
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('mousedown', handleClickOutside)

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  const position = getAdjustedPosition()

  const handleOpenInEditor = async () => {
    if (!nodePath) return
    try {
      await api.openInEditor(nodePath)
    } catch (err) {
      console.error('Failed to open in editor:', err)
    }
    onClose()
  }

  const handleRevealInFinder = async () => {
    if (!nodePath) return
    try {
      await api.revealInFinder(nodePath)
    } catch (err) {
      console.error('Failed to reveal in Finder:', err)
    }
    onClose()
  }

  const handleCopyPath = async () => {
    if (!nodePath) return
    try {
      await navigator.clipboard.writeText(nodePath)
    } catch (err) {
      console.error('Failed to copy path:', err)
    }
    onClose()
  }

  const handleHideFromGraph = () => {
    if (nodeId && onHideFromGraph) {
      onHideFromGraph(nodeId)
    }
    onClose()
  }

  const handleFocusNode = () => {
    if (nodeId && onFocusNode) {
      onFocusNode(nodeId)
    }
    onClose()
  }

  const handleRefreshNode = () => {
    if (nodeId && onRefreshNode) {
      onRefreshNode(nodeId)
    }
    onClose()
  }

  const handleDeleteNode = () => {
    if (nodeId && onDeleteNode) {
      onDeleteNode(nodeId)
    }
    onClose()
  }

  return (
    <div
      ref={menuRef}
      className="fixed z-50 min-w-[180px] bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-lg py-1 overflow-hidden"
      style={{
        left: position.x,
        top: position.y,
      }}
    >
      {/* File/Symbol specific actions */}
      {nodePath && (
        <>
          <MenuItem
            icon={<ExternalLink className="w-4 h-4" />}
            label="Open in Editor"
            onClick={handleOpenInEditor}
            shortcut="⌘O"
          />
          <MenuItem
            icon={<FolderOpen className="w-4 h-4" />}
            label="Reveal in Finder"
            onClick={handleRevealInFinder}
            shortcut="⌘⇧R"
          />
          <MenuItem
            icon={<Copy className="w-4 h-4" />}
            label="Copy Path"
            onClick={handleCopyPath}
            shortcut="⌘C"
          />
          <MenuDivider />
        </>
      )}

      {/* Node actions */}
      {nodeId && (
        <>
          {onFocusNode && (
            <MenuItem
              icon={<Focus className="w-4 h-4" />}
              label="Focus Node"
              onClick={handleFocusNode}
              shortcut="F"
            />
          )}
          {onRefreshNode && (
            <MenuItem
              icon={<RefreshCw className="w-4 h-4" />}
              label="Refresh"
              onClick={handleRefreshNode}
              shortcut="R"
            />
          )}
          {onHideFromGraph && (
            <MenuItem
              icon={<EyeOff className="w-4 h-4" />}
              label="Hide from Graph"
              onClick={handleHideFromGraph}
              shortcut="H"
            />
          )}
        </>
      )}

      {/* Danger zone */}
      {nodeId && onDeleteNode && (
        <>
          <MenuDivider />
          <MenuItem
            icon={<Trash2 className="w-4 h-4" />}
            label="Delete"
            onClick={handleDeleteNode}
            variant="danger"
            shortcut="⌫"
          />
        </>
      )}

      {/* Empty state */}
      {!nodePath && !nodeId && (
        <div className="px-3 py-2 text-sm text-zinc-500">
          No actions available
        </div>
      )}
    </div>
  )
}
