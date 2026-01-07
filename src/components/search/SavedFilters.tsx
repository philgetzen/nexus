import { useState } from 'react'
import {
  Bookmark,
  BookmarkPlus,
  Trash2,
  Check,
  X,
  ChevronDown,
} from 'lucide-react'
import { useAppStore } from '@/stores/useAppStore'
import type { SavedFilter, FilterState } from '@/types'

interface SavedFiltersProps {
  onApply?: (filter: FilterState) => void
}

export function SavedFilters({ onApply }: SavedFiltersProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [newFilterName, setNewFilterName] = useState('')

  const {
    filterState,
    savedFilters,
    saveFilter,
    deleteFilter,
    setFilterState,
  } = useAppStore()

  const handleSaveFilter = () => {
    if (!newFilterName.trim()) return

    const newFilter: SavedFilter = {
      id: crypto.randomUUID(),
      name: newFilterName.trim(),
      filter: { ...filterState },
    }

    saveFilter(newFilter)
    setNewFilterName('')
    setIsCreating(false)
  }

  const handleApplyFilter = (filter: SavedFilter) => {
    setFilterState(filter.filter)
    onApply?.(filter.filter)
    setIsOpen(false)
  }

  const handleDeleteFilter = (e: React.MouseEvent, filterId: string) => {
    e.stopPropagation()
    deleteFilter(filterId)
  }

  const hasActiveFilters =
    filterState.languages.length > 0 ||
    filterState.symbolKinds.length > 0 ||
    filterState.relationshipTypes.length < 7

  return (
    <div className="relative">
      {/* Trigger button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-1.5 px-2 py-1 text-sm rounded-md transition-colors ${
          savedFilters.length > 0
            ? 'text-violet-600 dark:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-900/20'
            : 'text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800'
        }`}
        title="Saved filters"
      >
        <Bookmark className="w-4 h-4" />
        {savedFilters.length > 0 && (
          <span className="text-xs">{savedFilters.length}</span>
        )}
        <ChevronDown className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute top-full right-0 mt-1 w-64 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-lg overflow-hidden z-50">
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-200 dark:border-zinc-700">
            <span className="text-sm font-medium">Saved Filters</span>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Content */}
          <div className="max-h-64 overflow-y-auto">
            {/* Saved filters list */}
            {savedFilters.length > 0 ? (
              <div className="py-1">
                {savedFilters.map((filter) => (
                  <button
                    key={filter.id}
                    onClick={() => handleApplyFilter(filter)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors group"
                  >
                    <Bookmark className="w-4 h-4 text-violet-500 flex-shrink-0" />
                    <span className="flex-1 text-sm truncate">{filter.name}</span>
                    <button
                      onClick={(e) => handleDeleteFilter(e, filter.id)}
                      className="p-1 text-zinc-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </button>
                ))}
              </div>
            ) : !isCreating ? (
              <div className="px-3 py-6 text-center text-sm text-zinc-500">
                No saved filters yet
              </div>
            ) : null}

            {/* Create new filter */}
            {isCreating ? (
              <div className="p-3 border-t border-zinc-200 dark:border-zinc-700">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newFilterName}
                    onChange={(e) => setNewFilterName(e.target.value)}
                    placeholder="Filter name..."
                    className="flex-1 px-2 py-1 text-sm bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded focus:outline-none focus:ring-1 focus:ring-violet-500"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveFilter()
                      if (e.key === 'Escape') {
                        setIsCreating(false)
                        setNewFilterName('')
                      }
                    }}
                  />
                  <button
                    onClick={handleSaveFilter}
                    disabled={!newFilterName.trim()}
                    className="p-1.5 bg-violet-500 text-white rounded hover:bg-violet-600 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => {
                      setIsCreating(false)
                      setNewFilterName('')
                    }}
                    className="p-1.5 text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-2 border-t border-zinc-200 dark:border-zinc-700">
                <button
                  onClick={() => setIsCreating(true)}
                  disabled={!hasActiveFilters}
                  className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium text-violet-600 dark:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-900/20 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <BookmarkPlus className="w-4 h-4" />
                  Save Current Filter
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
