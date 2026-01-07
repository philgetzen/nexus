import { useState } from 'react'
import {
  Filter,
  X,
  ChevronDown,
  ChevronRight,
  FileCode,
  FunctionSquare,
  Check,
  RotateCcw,
} from 'lucide-react'
import { useAppStore } from '@/stores/useAppStore'
import type { Language, SymbolKind, RelationshipKind, ViewMode } from '@/types'

interface FilterPanelProps {
  isOpen: boolean
  onClose: () => void
}

// =============================================================================
// Filter Options
// =============================================================================

const LANGUAGES: { value: Language; label: string; color: string }[] = [
  { value: 'typescript', label: 'TypeScript', color: 'bg-blue-500' },
  { value: 'javascript', label: 'JavaScript', color: 'bg-yellow-500' },
  { value: 'swift', label: 'Swift', color: 'bg-orange-500' },
  { value: 'python', label: 'Python', color: 'bg-green-500' },
  { value: 'go', label: 'Go', color: 'bg-cyan-500' },
  { value: 'rust', label: 'Rust', color: 'bg-orange-600' },
  { value: 'java', label: 'Java', color: 'bg-red-500' },
  { value: 'kotlin', label: 'Kotlin', color: 'bg-purple-500' },
  { value: 'c', label: 'C', color: 'bg-zinc-500' },
  { value: 'cpp', label: 'C++', color: 'bg-pink-500' },
  { value: 'csharp', label: 'C#', color: 'bg-violet-500' },
  { value: 'ruby', label: 'Ruby', color: 'bg-red-600' },
  { value: 'php', label: 'PHP', color: 'bg-indigo-500' },
]

const SYMBOL_KINDS: { value: SymbolKind; label: string }[] = [
  { value: 'function', label: 'Functions' },
  { value: 'class', label: 'Classes' },
  { value: 'interface', label: 'Interfaces' },
  { value: 'type', label: 'Types' },
  { value: 'enum', label: 'Enums' },
  { value: 'variable', label: 'Variables' },
  { value: 'constant', label: 'Constants' },
  { value: 'method', label: 'Methods' },
  { value: 'property', label: 'Properties' },
  { value: 'module', label: 'Modules' },
  { value: 'namespace', label: 'Namespaces' },
]

const RELATIONSHIP_KINDS: { value: RelationshipKind; label: string }[] = [
  { value: 'imports', label: 'Imports' },
  { value: 'exports', label: 'Exports' },
  { value: 'calls', label: 'Calls' },
  { value: 'extends', label: 'Extends' },
  { value: 'implements', label: 'Implements' },
  { value: 'references', label: 'References' },
  { value: 'contains', label: 'Contains' },
]

const VIEW_MODES: { value: ViewMode; label: string; icon: typeof FileCode }[] = [
  { value: 'file', label: 'File Level', icon: FileCode },
  { value: 'symbol', label: 'Symbol Level', icon: FunctionSquare },
]

// =============================================================================
// Components
// =============================================================================

interface FilterSectionProps {
  title: string
  isExpanded: boolean
  onToggle: () => void
  children: React.ReactNode
  count?: number
}

function FilterSection({ title, isExpanded, onToggle, children, count }: FilterSectionProps) {
  return (
    <div className="border-b border-zinc-200 dark:border-zinc-700 last:border-b-0">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-zinc-400" />
          ) : (
            <ChevronRight className="w-4 h-4 text-zinc-400" />
          )}
          <span>{title}</span>
        </div>
        {count !== undefined && count > 0 && (
          <span className="text-xs bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400 px-1.5 py-0.5 rounded">
            {count}
          </span>
        )}
      </button>
      {isExpanded && <div className="px-4 pb-3">{children}</div>}
    </div>
  )
}

interface CheckboxItemProps {
  label: string
  checked: boolean
  onChange: () => void
  color?: string
}

function CheckboxItem({ label, checked, onChange, color }: CheckboxItemProps) {
  return (
    <button
      onClick={onChange}
      className="flex items-center gap-2 py-1 cursor-pointer group w-full text-left"
    >
      <div
        className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
          checked
            ? 'bg-violet-500 border-violet-500'
            : 'border-zinc-300 dark:border-zinc-600 group-hover:border-zinc-400 dark:group-hover:border-zinc-500'
        }`}
      >
        {checked && <Check className="w-3 h-3 text-white" />}
      </div>
      {color && <div className={`w-2 h-2 rounded-full ${color}`} />}
      <span className="text-sm text-zinc-700 dark:text-zinc-300">{label}</span>
    </button>
  )
}

interface ViewModeSelectorProps {
  value: ViewMode
  onChange: (mode: ViewMode) => void
}

function ViewModeSelector({ value, onChange }: ViewModeSelectorProps) {
  return (
    <div className="flex gap-1 bg-zinc-100 dark:bg-zinc-800 p-1 rounded-lg">
      {VIEW_MODES.map((mode) => (
        <button
          key={mode.value}
          onClick={() => onChange(mode.value)}
          className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
            value === mode.value
              ? 'bg-white dark:bg-zinc-700 shadow-sm text-violet-600 dark:text-violet-400'
              : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
          }`}
        >
          <mode.icon className="w-4 h-4" />
          {mode.label}
        </button>
      ))}
    </div>
  )
}

// =============================================================================
// Main Component
// =============================================================================

export function FilterPanel({ isOpen, onClose }: FilterPanelProps) {
  const { filterState, setFilterState, viewMode, setViewMode } = useAppStore()

  const [expandedSections, setExpandedSections] = useState({
    viewMode: true,
    languages: true,
    symbolKinds: false,
    relationships: false,
  })

  if (!isOpen) return null

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }))
  }

  const toggleLanguage = (language: Language) => {
    const current = filterState.languages
    const next = current.includes(language)
      ? current.filter((l) => l !== language)
      : [...current, language]
    setFilterState({ ...filterState, languages: next })
  }

  const toggleSymbolKind = (kind: SymbolKind) => {
    const current = filterState.symbolKinds
    const next = current.includes(kind)
      ? current.filter((k) => k !== kind)
      : [...current, kind]
    setFilterState({ ...filterState, symbolKinds: next })
  }

  const toggleRelationship = (kind: RelationshipKind) => {
    const current = filterState.relationshipTypes
    const next = current.includes(kind)
      ? current.filter((k) => k !== kind)
      : [...current, kind]
    setFilterState({ ...filterState, relationshipTypes: next })
  }

  const resetFilters = () => {
    setFilterState({
      viewMode: 'file',
      languages: [],
      nodeTypes: ['file', 'symbol'],
      relationshipTypes: ['imports', 'exports', 'calls', 'extends', 'implements', 'references', 'contains'],
      symbolKinds: [],
      clusters: [],
      searchQuery: null,
    })
    setViewMode('file')
  }

  const activeFilterCount =
    filterState.languages.length +
    filterState.symbolKinds.length +
    (filterState.relationshipTypes.length < RELATIONSHIP_KINDS.length
      ? RELATIONSHIP_KINDS.length - filterState.relationshipTypes.length
      : 0)

  return (
    <div className="absolute top-full right-0 mt-1 w-80 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-lg overflow-hidden z-50">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-200 dark:border-zinc-700">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-violet-500" />
          <span className="font-medium text-sm">Filters</span>
          {activeFilterCount > 0 && (
            <span className="text-xs bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400 px-1.5 py-0.5 rounded">
              {activeFilterCount} active
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={resetFilters}
            className="p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
            title="Reset filters"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          <button
            onClick={onClose}
            className="p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="max-h-96 overflow-y-auto">
        {/* View Mode */}
        <FilterSection
          title="View Mode"
          isExpanded={expandedSections.viewMode}
          onToggle={() => toggleSection('viewMode')}
        >
          <ViewModeSelector value={viewMode} onChange={setViewMode} />
        </FilterSection>

        {/* Languages */}
        <FilterSection
          title="Languages"
          isExpanded={expandedSections.languages}
          onToggle={() => toggleSection('languages')}
          count={filterState.languages.length}
        >
          <div className="grid grid-cols-2 gap-x-4">
            {LANGUAGES.map((lang) => (
              <CheckboxItem
                key={lang.value}
                label={lang.label}
                checked={filterState.languages.includes(lang.value)}
                onChange={() => toggleLanguage(lang.value)}
                color={lang.color}
              />
            ))}
          </div>
        </FilterSection>

        {/* Symbol Kinds */}
        <FilterSection
          title="Symbol Types"
          isExpanded={expandedSections.symbolKinds}
          onToggle={() => toggleSection('symbolKinds')}
          count={filterState.symbolKinds.length}
        >
          <div className="grid grid-cols-2 gap-x-4">
            {SYMBOL_KINDS.map((kind) => (
              <CheckboxItem
                key={kind.value}
                label={kind.label}
                checked={filterState.symbolKinds.includes(kind.value)}
                onChange={() => toggleSymbolKind(kind.value)}
              />
            ))}
          </div>
        </FilterSection>

        {/* Relationships */}
        <FilterSection
          title="Relationships"
          isExpanded={expandedSections.relationships}
          onToggle={() => toggleSection('relationships')}
          count={
            RELATIONSHIP_KINDS.length - filterState.relationshipTypes.length > 0
              ? RELATIONSHIP_KINDS.length - filterState.relationshipTypes.length
              : undefined
          }
        >
          <div className="space-y-1">
            {RELATIONSHIP_KINDS.map((rel) => (
              <CheckboxItem
                key={rel.value}
                label={rel.label}
                checked={filterState.relationshipTypes.includes(rel.value)}
                onChange={() => toggleRelationship(rel.value)}
              />
            ))}
          </div>
        </FilterSection>
      </div>
    </div>
  )
}
