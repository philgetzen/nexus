import { useState, useCallback, useRef, useEffect } from 'react'
import { FolderOpen, Upload } from 'lucide-react'
import { listen } from '@tauri-apps/api/event'

interface DropZoneProps {
  children: React.ReactNode
  onDrop: (path: string) => void
  disabled?: boolean
}

interface TauriDropEvent {
  paths: string[]
  position: { x: number; y: number }
}

/**
 * Drop zone component for drag-and-drop project opening
 * Uses Tauri's native drag-and-drop events
 */
export function DropZone({ children, onDrop, disabled = false }: DropZoneProps) {
  const [isDragging, setIsDragging] = useState(false)
  const dropRef = useRef<HTMLDivElement>(null)
  const dragCounter = useRef(0)

  // Listen for Tauri's native file drop events
  useEffect(() => {
    let unlistenHover: (() => void) | undefined
    let unlistenDrop: (() => void) | undefined
    let unlistenCancel: (() => void) | undefined

    const setupListeners = async () => {
      // Listen for drag hover (file entering window)
      unlistenHover = await listen<TauriDropEvent>('tauri://drag-over', () => {
        if (!disabled) {
          setIsDragging(true)
        }
      })

      // Listen for drag leave
      unlistenCancel = await listen('tauri://drag-leave', () => {
        setIsDragging(false)
      })

      // Listen for file drop
      unlistenDrop = await listen<TauriDropEvent>('tauri://drop', (event) => {
        setIsDragging(false)
        if (!disabled && event.payload.paths.length > 0) {
          // Only accept the first path (directory)
          const path = event.payload.paths[0]
          onDrop(path)
        }
      })
    }

    setupListeners()

    return () => {
      unlistenHover?.()
      unlistenDrop?.()
      unlistenCancel?.()
    }
  }, [disabled, onDrop])

  // Fallback HTML5 drag-and-drop for development
  const handleDragEnter = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      dragCounter.current++
      if (e.dataTransfer.items && e.dataTransfer.items.length > 0 && !disabled) {
        setIsDragging(true)
      }
    },
    [disabled]
  )

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounter.current--
    if (dragCounter.current === 0) {
      setIsDragging(false)
    }
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragging(false)
      dragCounter.current = 0

      // HTML5 drop doesn't give us file paths in web context
      // This is a fallback for development - Tauri events handle production
      if (disabled) return

      // In development, we can't get the actual path from HTML5 drop
      // The Tauri event listener above handles this in production
      console.log('HTML5 drop detected - use Tauri in production for file paths')
    },
    [disabled]
  )

  return (
    <div
      ref={dropRef}
      className="relative w-full h-full"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {children}

      {/* Overlay when dragging */}
      {isDragging && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-violet-500/10 backdrop-blur-sm border-2 border-dashed border-violet-500 rounded-lg">
          <div className="flex flex-col items-center gap-3 p-6 bg-white dark:bg-zinc-900 rounded-xl shadow-lg">
            <div className="w-16 h-16 rounded-full bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
              <FolderOpen className="w-8 h-8 text-violet-500" />
            </div>
            <div className="text-center">
              <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                Drop folder here
              </p>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                Release to open project
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * Simple drop zone for use as a standalone landing area
 */
interface SimpleDropZoneProps {
  onDrop: (path: string) => void
  onBrowse: () => void
}

export function SimpleDropZone({ onDrop, onBrowse }: SimpleDropZoneProps) {
  const [isDragging, setIsDragging] = useState(false)

  // Listen for Tauri's native file drop events
  useEffect(() => {
    let unlistenHover: (() => void) | undefined
    let unlistenDrop: (() => void) | undefined
    let unlistenCancel: (() => void) | undefined

    const setupListeners = async () => {
      unlistenHover = await listen<TauriDropEvent>('tauri://drag-over', () => {
        setIsDragging(true)
      })

      unlistenCancel = await listen('tauri://drag-leave', () => {
        setIsDragging(false)
      })

      unlistenDrop = await listen<TauriDropEvent>('tauri://drop', (event) => {
        setIsDragging(false)
        if (event.payload.paths.length > 0) {
          onDrop(event.payload.paths[0])
        }
      })
    }

    setupListeners()

    return () => {
      unlistenHover?.()
      unlistenDrop?.()
      unlistenCancel?.()
    }
  }, [onDrop])

  return (
    <div
      className={`flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-xl transition-all ${
        isDragging
          ? 'border-violet-500 bg-violet-50 dark:bg-violet-900/20'
          : 'border-zinc-300 dark:border-zinc-600 hover:border-zinc-400 dark:hover:border-zinc-500'
      }`}
    >
      <div
        className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 transition-colors ${
          isDragging
            ? 'bg-violet-100 dark:bg-violet-900/30'
            : 'bg-zinc-100 dark:bg-zinc-800'
        }`}
      >
        <Upload
          className={`w-8 h-8 ${
            isDragging ? 'text-violet-500' : 'text-zinc-400'
          }`}
        />
      </div>
      <p className="text-lg font-medium text-zinc-700 dark:text-zinc-300 mb-2">
        {isDragging ? 'Drop folder here' : 'Drop a project folder'}
      </p>
      <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">
        or click to browse
      </p>
      <button
        onClick={onBrowse}
        className="px-4 py-2 text-sm font-medium bg-violet-500 text-white hover:bg-violet-600 rounded-lg transition-colors"
      >
        Browse Folders
      </button>
    </div>
  )
}
