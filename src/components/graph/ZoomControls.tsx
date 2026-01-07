import { ZoomIn, ZoomOut, Maximize2 } from 'lucide-react'

interface ZoomControlsProps {
  zoom: number
  onZoomIn?: () => void
  onZoomOut?: () => void
  onFitToView?: () => void
}

export function ZoomControls({ zoom, onZoomIn, onZoomOut, onFitToView }: ZoomControlsProps) {
  return (
    <div
      className="bg-zinc-900/90 backdrop-blur-sm border border-zinc-700 rounded-lg shadow-xl flex items-center"
      data-testid="zoom-controls"
    >
      <button
        onClick={onZoomOut}
        className="p-2 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded-l-lg transition-colors"
        title="Zoom out"
        aria-label="Zoom out"
      >
        <ZoomOut className="w-4 h-4" />
      </button>

      <div className="px-3 py-2 border-x border-zinc-700 min-w-[60px] text-center">
        <span className="text-xs font-mono text-zinc-300">{Math.round(zoom)}%</span>
      </div>

      <button
        onClick={onZoomIn}
        className="p-2 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
        title="Zoom in"
        aria-label="Zoom in"
      >
        <ZoomIn className="w-4 h-4" />
      </button>

      <div className="w-px h-6 bg-zinc-700" />

      <button
        onClick={onFitToView}
        className="p-2 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded-r-lg transition-colors"
        title="Fit to view"
        aria-label="Fit to view"
      >
        <Maximize2 className="w-4 h-4" />
      </button>
    </div>
  )
}
