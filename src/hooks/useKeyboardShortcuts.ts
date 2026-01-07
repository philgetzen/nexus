import { useEffect, useCallback } from 'react'
import { useAppStore } from '@/stores/useAppStore'

/**
 * Global keyboard shortcuts for the application
 *
 * Shortcuts:
 * - ⌘1: Toggle sidebar
 * - ⌘2: Toggle inspector
 * - ⌘K: Focus search
 * - Escape: Clear selection / close modals
 */
export function useKeyboardShortcuts() {
  const {
    toggleSidebar,
    toggleInspector,
    setSearchFocused,
    selectNode,
  } = useAppStore()

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0
      const cmdKey = isMac ? event.metaKey : event.ctrlKey

      // ⌘1: Toggle sidebar
      if (cmdKey && event.key === '1') {
        event.preventDefault()
        toggleSidebar()
        return
      }

      // ⌘2: Toggle inspector
      if (cmdKey && event.key === '2') {
        event.preventDefault()
        toggleInspector()
        return
      }

      // ⌘K: Focus search
      if (cmdKey && event.key === 'k') {
        event.preventDefault()
        setSearchFocused(true)
        return
      }

      // Escape: Clear selection
      if (event.key === 'Escape') {
        selectNode(null)
        setSearchFocused(false)
        return
      }
    },
    [toggleSidebar, toggleInspector, setSearchFocused, selectNode]
  )

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [handleKeyDown])
}
