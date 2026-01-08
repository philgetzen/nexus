import { FileCode, FunctionSquare, Box, Type, ArrowDownLeft, ArrowUpRight } from 'lucide-react'
import type { Language, SymbolKind } from '@/types'

export interface NodePopoverContent {
  name: string
  type: 'file' | SymbolKind
  path: string
  language?: Language
  incomingCount: number
  outgoingCount: number
  lineInfo: number
}

interface NodePopoverProps {
  content: NodePopoverContent
}

const typeIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  file: FileCode,
  function: FunctionSquare,
  method: FunctionSquare,
  class: Box,
  type: Type,
  interface: Type,
  enum: Type,
  variable: Type,
  constant: Type,
  property: Type,
  module: FileCode,
  namespace: FileCode,
}

const typeLabels: Record<string, string> = {
  file: 'File',
  function: 'Function',
  method: 'Method',
  class: 'Class',
  type: 'Type',
  interface: 'Interface',
  enum: 'Enum',
  variable: 'Variable',
  constant: 'Constant',
  property: 'Property',
  module: 'Module',
  namespace: 'Namespace',
}

const languageColors: Partial<Record<Language, string>> = {
  typescript: 'bg-blue-500',
  javascript: 'bg-yellow-500',
  python: 'bg-green-500',
  swift: 'bg-orange-500',
  go: 'bg-cyan-500',
  rust: 'bg-orange-600',
  java: 'bg-red-500',
  kotlin: 'bg-purple-500',
  c: 'bg-gray-500',
  cpp: 'bg-blue-600',
  csharp: 'bg-green-600',
  ruby: 'bg-red-600',
  php: 'bg-indigo-500',
}

export function NodePopover({ content }: NodePopoverProps) {
  const Icon = typeIcons[content.type] || FileCode
  const typeLabel = typeLabels[content.type] || 'Unknown'
  const langColor = content.language ? languageColors[content.language] || 'bg-zinc-500' : 'bg-zinc-500'

  return (
    <div
      className="bg-zinc-900/95 backdrop-blur-sm border border-zinc-700 rounded-lg shadow-xl p-3 text-left w-[220px]"
      data-testid="node-popover"
    >
      {/* Header */}
      <div className="flex items-start gap-2 mb-2">
        <Icon className="w-4 h-4 text-violet-400 flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm text-zinc-100 truncate">{content.name}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs text-zinc-400">{typeLabel}</span>
            {content.language && (
              <span
                className={`w-2 h-2 rounded-full ${langColor}`}
                title={content.language}
              />
            )}
          </div>
        </div>
      </div>

      {/* Path */}
      <p className="text-xs font-mono text-zinc-500 truncate mb-2">{content.path}</p>

      {/* Stats */}
      <div className="flex items-center gap-4 text-xs">
        <div className="flex items-center gap-1 text-cyan-400">
          <ArrowDownLeft className="w-3 h-3" />
          <span>{content.incomingCount} in</span>
        </div>
        <div className="flex items-center gap-1 text-violet-400">
          <ArrowUpRight className="w-3 h-3" />
          <span>{content.outgoingCount} out</span>
        </div>
        <div className="text-zinc-500">
          {content.type === 'file' ? `${content.lineInfo} lines` : `Line ${content.lineInfo}`}
        </div>
      </div>
    </div>
  )
}
