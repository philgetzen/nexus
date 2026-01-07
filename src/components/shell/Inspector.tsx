import { useState, useEffect, useCallback } from 'react'
import {
  X,
  FileCode,
  FunctionSquare,
  Box,
  Type,
  ArrowDownLeft,
  ArrowUpRight,
  ExternalLink,
  Copy,
  ChevronDown,
  ChevronRight,
  Loader2,
  AlertCircle,
  Hash,
  Code,
} from 'lucide-react'
import { useAppStore } from '@/stores/useAppStore'
import * as api from '@/lib/tauri'
import type { NodeDetails, Relationship } from '@/lib/tauri'
import type { SymbolKind } from '@/types'

// =============================================================================
// Helper Components
// =============================================================================

function NodeTypeIcon({ type, symbolKind }: { type: string; symbolKind?: SymbolKind }) {
  if (type === 'file') {
    return <FileCode className="w-5 h-5 text-cyan-500" />
  }

  const icons: Partial<Record<SymbolKind, typeof FunctionSquare>> = {
    function: FunctionSquare,
    method: FunctionSquare,
    class: Box,
    type: Type,
    interface: Type,
    enum: Type,
  }

  const colors: Partial<Record<SymbolKind, string>> = {
    function: 'text-violet-500',
    method: 'text-violet-500',
    class: 'text-amber-500',
    type: 'text-emerald-500',
    interface: 'text-emerald-500',
    enum: 'text-blue-500',
  }

  const kind = symbolKind || 'function'
  const Icon = icons[kind] || FunctionSquare
  const color = colors[kind] || 'text-zinc-400'

  return <Icon className={`w-5 h-5 ${color}`} />
}

function LanguageBadge({ language }: { language?: string }) {
  if (!language) return null

  const colors: Record<string, string> = {
    typescript: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    javascript: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    swift: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
    python: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    go: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400',
    rust: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  }

  return (
    <span
      className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
        colors[language] || 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400'
      }`}
    >
      {language}
    </span>
  )
}

interface CollapsibleSectionProps {
  title: string
  icon?: React.ReactNode
  count?: number
  defaultOpen?: boolean
  children: React.ReactNode
}

function CollapsibleSection({
  title,
  icon,
  count,
  defaultOpen = true,
  children,
}: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  return (
    <div>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-1.5 text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors"
      >
        {isOpen ? (
          <ChevronDown className="w-3 h-3" />
        ) : (
          <ChevronRight className="w-3 h-3" />
        )}
        {icon}
        <span>{title}</span>
        {count !== undefined && (
          <span className="text-zinc-400 normal-case">({count})</span>
        )}
      </button>
      {isOpen && children}
    </div>
  )
}

interface RelationshipListProps {
  relationships: Relationship[]
  direction: 'incoming' | 'outgoing'
  onNavigate: (nodeId: string) => void
}

function RelationshipList({ relationships, direction, onNavigate }: RelationshipListProps) {
  if (relationships.length === 0) {
    return (
      <p className="text-xs text-zinc-400 italic">No {direction} relationships</p>
    )
  }

  // Group by kind
  const grouped = relationships.reduce(
    (acc, rel) => {
      const kind = rel.kind
      if (!acc[kind]) acc[kind] = []
      acc[kind].push(rel)
      return acc
    },
    {} as Record<string, Relationship[]>
  )

  return (
    <div className="space-y-2">
      {Object.entries(grouped).map(([kind, rels]) => (
        <div key={kind}>
          <div className="text-[10px] text-zinc-400 uppercase tracking-wider mb-1">
            {kind} ({rels.length})
          </div>
          <div className="space-y-1">
            {rels.map((rel) => {
              const targetId = direction === 'incoming' ? rel.sourceId : rel.targetId
              return (
                <button
                  key={rel.id}
                  onClick={() => onNavigate(targetId)}
                  className="w-full flex items-center gap-2 px-2 py-1.5 text-left text-sm bg-zinc-100 dark:bg-zinc-800/50 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded transition-colors"
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      direction === 'incoming' ? 'bg-cyan-500' : 'bg-violet-500'
                    }`}
                  />
                  <span className="flex-1 truncate font-mono text-xs">{targetId}</span>
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

// =============================================================================
// Main Component
// =============================================================================

export function Inspector() {
  const { panels, toggleInspector, selectedNodeId, selectNode } = useAppStore()
  const [details, setDetails] = useState<NodeDetails | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fetch node details when selection changes
  useEffect(() => {
    if (!selectedNodeId) {
      setDetails(null)
      setError(null)
      return
    }

    let cancelled = false

    const fetchDetails = async () => {
      setIsLoading(true)
      setError(null)

      try {
        const nodeDetails = await api.getNodeDetails(selectedNodeId)
        if (!cancelled) {
          setDetails(nodeDetails)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load details')
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    fetchDetails()

    return () => {
      cancelled = true
    }
  }, [selectedNodeId])

  const handleNavigate = useCallback(
    (nodeId: string) => {
      selectNode(nodeId)
    },
    [selectNode]
  )

  const handleOpenInEditor = useCallback(async () => {
    const path = details?.file?.absolutePath || details?.containingFile?.absolutePath
    if (!path) return

    try {
      await api.openInEditor(path)
    } catch (err) {
      console.error('Failed to open in editor:', err)
    }
  }, [details])

  const handleCopyPath = useCallback(async () => {
    const path = details?.file?.path || details?.containingFile?.path
    if (!path) return

    try {
      await navigator.clipboard.writeText(path)
    } catch (err) {
      console.error('Failed to copy path:', err)
    }
  }, [details])

  if (!panels.inspectorOpen) return null

  return (
    <aside className="w-72 flex-shrink-0 border-l border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="p-3 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
        <h3 className="font-medium text-sm">Inspector</h3>
        <button
          onClick={toggleInspector}
          className="p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
          aria-label="Close inspector"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-6 h-6 text-violet-500 animate-spin" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-full p-4 text-center">
            <AlertCircle className="w-8 h-8 text-red-500 mb-2" />
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          </div>
        ) : details ? (
          <div className="p-3 space-y-4">
            {/* Node identity */}
            <div className="flex items-start gap-3">
              <NodeTypeIcon
                type={details.nodeType}
                symbolKind={details.symbol?.kind as SymbolKind | undefined}
              />
              <div className="flex-1 min-w-0">
                <h4 className="font-medium text-sm truncate">
                  {details.file?.name || details.symbol?.name || 'Unknown'}
                </h4>
                <div className="flex items-center gap-2 mt-0.5">
                  <p className="text-xs text-zinc-500 capitalize">
                    {details.nodeType === 'file'
                      ? 'File'
                      : details.symbol?.kind || 'Symbol'}
                  </p>
                  <LanguageBadge language={details.file?.language} />
                </div>
              </div>
            </div>

            {/* Quick actions */}
            <div className="flex gap-2">
              <button
                onClick={handleOpenInEditor}
                className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs font-medium bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Open
              </button>
              <button
                onClick={handleCopyPath}
                className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs font-medium bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded transition-colors"
              >
                <Copy className="w-3.5 h-3.5" />
                Copy Path
              </button>
            </div>

            {/* Location */}
            <CollapsibleSection title="Location" icon={<FileCode className="w-3 h-3" />}>
              <p className="text-xs font-mono text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800/50 px-2 py-1.5 rounded truncate">
                {details.file?.path || details.containingFile?.path || 'Unknown'}
                {details.symbol?.line && `:${details.symbol.line}`}
              </p>
            </CollapsibleSection>

            {/* File stats */}
            {details.file && (
              <CollapsibleSection title="Stats" icon={<Hash className="w-3 h-3" />}>
                <div className="grid grid-cols-2 gap-2">
                  <div className="text-xs">
                    <span className="text-zinc-500">Lines: </span>
                    <span className="font-medium">{details.file.lineCount}</span>
                  </div>
                  {details.symbolsInFile && (
                    <div className="text-xs">
                      <span className="text-zinc-500">Symbols: </span>
                      <span className="font-medium">{details.symbolsInFile.length}</span>
                    </div>
                  )}
                </div>
              </CollapsibleSection>
            )}

            {/* Symbols in file */}
            {details.symbolsInFile && details.symbolsInFile.length > 0 && (
              <CollapsibleSection
                title="Symbols"
                icon={<Code className="w-3 h-3" />}
                count={details.symbolsInFile.length}
                defaultOpen={details.symbolsInFile.length <= 10}
              >
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {details.symbolsInFile.map((symbol) => (
                    <button
                      key={symbol.id}
                      onClick={() => handleNavigate(symbol.id)}
                      className="w-full flex items-center gap-2 px-2 py-1 text-left text-xs bg-zinc-100 dark:bg-zinc-800/50 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded transition-colors"
                    >
                      <NodeTypeIcon type="symbol" symbolKind={symbol.kind as SymbolKind} />
                      <span className="flex-1 truncate font-mono">{symbol.name}</span>
                      <span className="text-zinc-400">:{symbol.line}</span>
                    </button>
                  ))}
                </div>
              </CollapsibleSection>
            )}

            {/* Incoming relationships */}
            <CollapsibleSection
              title="Incoming"
              icon={<ArrowDownLeft className="w-3 h-3" />}
              count={details.incomingRelationships.length}
              defaultOpen={details.incomingRelationships.length <= 5}
            >
              <RelationshipList
                relationships={details.incomingRelationships}
                direction="incoming"
                onNavigate={handleNavigate}
              />
            </CollapsibleSection>

            {/* Outgoing relationships */}
            <CollapsibleSection
              title="Outgoing"
              icon={<ArrowUpRight className="w-3 h-3" />}
              count={details.outgoingRelationships.length}
              defaultOpen={details.outgoingRelationships.length <= 5}
            >
              <RelationshipList
                relationships={details.outgoingRelationships}
                direction="outgoing"
                onNavigate={handleNavigate}
              />
            </CollapsibleSection>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center p-8 text-center h-full">
            <div className="text-zinc-400">
              <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                <FileCode className="w-6 h-6" />
              </div>
              <p className="text-sm">Select a node to see details</p>
              <p className="text-xs mt-1">Click on any file, function, or type in the graph</p>
            </div>
          </div>
        )}
      </div>
    </aside>
  )
}
