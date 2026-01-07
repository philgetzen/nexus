import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { Search, X, FileCode, FunctionSquare, Box, Type } from 'lucide-react'
import { useAppStore } from '@/stores/useAppStore'
import type { GraphNode, SymbolKind, Language } from '@/types'

interface SearchBarProps {
  onSelectNode?: (nodeId: string) => void
  placeholder?: string
}

interface SearchResult {
  node: GraphNode
  matchType: 'name' | 'path'
  highlightRange?: [number, number]
}

/**
 * Get icon for a node based on type and symbol kind
 */
function getNodeIcon(node: GraphNode) {
  if (node.type === 'file') {
    return <FileCode className="w-4 h-4 text-cyan-500" />
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

  const kind = node.symbolKind || 'function'
  const Icon = icons[kind] || FunctionSquare
  const color = colors[kind] || 'text-zinc-400'

  return <Icon className={`w-4 h-4 ${color}`} />
}

/**
 * Get language badge color
 */
function getLanguageColor(language: Language): string {
  const colors: Partial<Record<Language, string>> = {
    typescript: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    javascript: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    swift: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
    python: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    go: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400',
    rust: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  }
  return colors[language] || 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400'
}

/**
 * Highlight matching text in a string
 */
function HighlightedText({ text, query }: { text: string; query: string }) {
  if (!query.trim()) return <>{text}</>

  const lowerText = text.toLowerCase()
  const lowerQuery = query.toLowerCase()
  const index = lowerText.indexOf(lowerQuery)

  if (index === -1) return <>{text}</>

  return (
    <>
      {text.slice(0, index)}
      <mark className="bg-yellow-200 dark:bg-yellow-900/50 text-inherit rounded px-0.5">
        {text.slice(index, index + query.length)}
      </mark>
      {text.slice(index + query.length)}
    </>
  )
}

export function SearchBar({ onSelectNode, placeholder = 'Search files, functions, types...' }: SearchBarProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [localQuery, setLocalQuery] = useState('')

  const {
    nodes,
    searchQuery,
    setSearchQuery,
    isSearchFocused,
    setSearchFocused,
    selectNode,
  } = useAppStore()

  // Sync local query with store
  useEffect(() => {
    setLocalQuery(searchQuery)
  }, [searchQuery])

  // Focus input when search is focused from keyboard shortcut
  useEffect(() => {
    if (isSearchFocused && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isSearchFocused])

  // Search results with fuzzy matching
  const results = useMemo<SearchResult[]>(() => {
    if (!localQuery.trim()) return []

    const query = localQuery.toLowerCase()
    const matched: SearchResult[] = []

    for (const node of nodes) {
      // Match by name
      if (node.name.toLowerCase().includes(query)) {
        matched.push({ node, matchType: 'name' })
        continue
      }

      // Match by path (for file nodes)
      if (node.path && node.path.toLowerCase().includes(query)) {
        matched.push({ node, matchType: 'path' })
      }
    }

    // Sort: exact matches first, then by name length
    return matched
      .sort((a, b) => {
        const aExact = a.node.name.toLowerCase() === query
        const bExact = b.node.name.toLowerCase() === query
        if (aExact && !bExact) return -1
        if (!aExact && bExact) return 1
        return a.node.name.length - b.node.name.length
      })
      .slice(0, 20) // Limit results
  }, [nodes, localQuery])

  // Reset selected index when results change
  useEffect(() => {
    setSelectedIndex(0)
  }, [results])

  // Debounce search query update to store
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchQuery(localQuery)
    }, 150)
    return () => clearTimeout(timer)
  }, [localQuery, setSearchQuery])

  const handleSelect = useCallback(
    (nodeId: string) => {
      selectNode(nodeId)
      onSelectNode?.(nodeId)
      setIsOpen(false)
      inputRef.current?.blur()
    },
    [selectNode, onSelectNode]
  )

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || results.length === 0) {
      if (e.key === 'ArrowDown' && results.length > 0) {
        setIsOpen(true)
      }
      return
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex((i) => (i + 1) % results.length)
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex((i) => (i - 1 + results.length) % results.length)
        break
      case 'Enter':
        e.preventDefault()
        if (results[selectedIndex]) {
          handleSelect(results[selectedIndex].node.id)
        }
        break
      case 'Escape':
        e.preventDefault()
        setIsOpen(false)
        inputRef.current?.blur()
        break
    }
  }

  const handleFocus = () => {
    setSearchFocused(true)
    if (localQuery.trim() && results.length > 0) {
      setIsOpen(true)
    }
  }

  const handleBlur = (e: React.FocusEvent) => {
    // Don't close if clicking on dropdown
    if (dropdownRef.current?.contains(e.relatedTarget as Node)) {
      return
    }
    setSearchFocused(false)
    // Delay closing to allow click events
    setTimeout(() => setIsOpen(false), 150)
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setLocalQuery(value)
    setIsOpen(value.trim().length > 0)
  }

  const handleClear = () => {
    setLocalQuery('')
    setSearchQuery('')
    setIsOpen(false)
    inputRef.current?.focus()
  }

  return (
    <div className="relative flex-1 max-w-md">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
        <input
          ref={inputRef}
          type="text"
          value={localQuery}
          onChange={handleChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="w-full h-8 pl-9 pr-16 text-sm bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-md focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent placeholder:text-zinc-400"
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {localQuery && (
            <button
              onClick={handleClear}
              className="p-0.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
              tabIndex={-1}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <kbd className="text-[10px] font-medium text-zinc-400 bg-zinc-200 dark:bg-zinc-800 px-1.5 py-0.5 rounded">
            ⌘K
          </kbd>
        </div>
      </div>

      {/* Dropdown results */}
      {isOpen && (
        <div
          ref={dropdownRef}
          className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-lg overflow-hidden z-50 max-h-80 overflow-y-auto"
        >
          {results.length > 0 ? (
            <div className="py-1">
              {results.map((result, index) => (
                <button
                  key={result.node.id}
                  onClick={() => handleSelect(result.node.id)}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-left transition-colors ${
                    index === selectedIndex
                      ? 'bg-violet-50 dark:bg-violet-900/20'
                      : 'hover:bg-zinc-50 dark:hover:bg-zinc-800'
                  }`}
                >
                  {getNodeIcon(result.node)}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">
                      <HighlightedText text={result.node.name} query={localQuery} />
                    </div>
                    {result.node.path && (
                      <div className="text-xs text-zinc-500 truncate font-mono">
                        <HighlightedText text={result.node.path} query={localQuery} />
                      </div>
                    )}
                  </div>
                  {result.node.language && (
                    <span
                      className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${getLanguageColor(
                        result.node.language
                      )}`}
                    >
                      {result.node.language}
                    </span>
                  )}
                </button>
              ))}
            </div>
          ) : localQuery.trim() ? (
            <div className="px-3 py-6 text-center text-sm text-zinc-500">
              No results for "{localQuery}"
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}
