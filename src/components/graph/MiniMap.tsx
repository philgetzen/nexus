import type { GraphNode, GraphEdge } from '@/types'

interface MiniMapProps {
  nodes: GraphNode[]
  edges: GraphEdge[]
  viewportX: number
  viewportY: number
  viewportWidth: number
  viewportHeight: number
  zoom: number
  onNavigate?: (x: number, y: number) => void
}

export function MiniMap({
  nodes,
  edges,
  viewportX,
  viewportY,
  viewportWidth,
  viewportHeight,
  zoom,
  onNavigate,
}: MiniMapProps) {
  const minimapWidth = 160
  const minimapHeight = 100

  // Handle empty nodes case
  if (nodes.length === 0) {
    return (
      <div
        className="bg-zinc-900/90 backdrop-blur-sm border border-zinc-700 rounded-lg p-2 shadow-xl"
        data-testid="mini-map"
      >
        <div
          className="flex items-center justify-center text-zinc-500 text-xs"
          style={{ width: minimapWidth, height: minimapHeight }}
        >
          No nodes
        </div>
      </div>
    )
  }

  // Calculate bounds of all nodes
  const bounds = nodes.reduce(
    (acc, node) => ({
      minX: Math.min(acc.minX, node.position?.x ?? 0),
      maxX: Math.max(acc.maxX, node.position?.x ?? 0),
      minY: Math.min(acc.minY, node.position?.y ?? 0),
      maxY: Math.max(acc.maxY, node.position?.y ?? 0),
    }),
    { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity }
  )

  // Add padding
  const padding = 50
  bounds.minX -= padding
  bounds.maxX += padding
  bounds.minY -= padding
  bounds.maxY += padding

  const graphWidth = bounds.maxX - bounds.minX
  const graphHeight = bounds.maxY - bounds.minY

  // Scale to fit minimap
  const scaleX = minimapWidth / graphWidth
  const scaleY = minimapHeight / graphHeight
  const scale = Math.min(scaleX, scaleY)

  // Transform graph coords to minimap coords
  const toMinimapX = (x: number) => (x - bounds.minX) * scale
  const toMinimapY = (y: number) => (y - bounds.minY) * scale

  // Viewport rect in minimap coords (zoom is in percentage, convert to decimal)
  const zoomDecimal = zoom / 100
  const vpX = toMinimapX(viewportX)
  const vpY = toMinimapY(viewportY)
  const vpW = (viewportWidth / zoomDecimal) * scale
  const vpH = (viewportHeight / zoomDecimal) * scale

  // Create position lookup for edges
  const nodePositions = Object.fromEntries(nodes.map((n) => [n.id, n.position]))

  const handleClick = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const clickX = e.clientX - rect.left
    const clickY = e.clientY - rect.top

    // Convert minimap coords back to graph coords
    const graphX = clickX / scale + bounds.minX
    const graphY = clickY / scale + bounds.minY

    onNavigate?.(graphX, graphY)
  }

  return (
    <div
      className="bg-zinc-900/90 backdrop-blur-sm border border-zinc-700 rounded-lg p-2 shadow-xl"
      data-testid="mini-map"
    >
      <svg
        width={minimapWidth}
        height={minimapHeight}
        className="cursor-crosshair"
        onClick={handleClick}
      >
        {/* Background */}
        <rect
          width={minimapWidth}
          height={minimapHeight}
          className="fill-zinc-800/50"
          rx={4}
        />

        {/* Edges */}
        {edges.map((edge) => {
          const source = nodePositions[edge.source]
          const target = nodePositions[edge.target]
          if (!source || !target) return null

          return (
            <line
              key={edge.id}
              x1={toMinimapX(source.x)}
              y1={toMinimapY(source.y)}
              x2={toMinimapX(target.x)}
              y2={toMinimapY(target.y)}
              className="stroke-zinc-600"
              strokeWidth={0.5}
              strokeOpacity={0.5}
            />
          )
        })}

        {/* Nodes */}
        {nodes.map((node) => (
          <circle
            key={node.id}
            cx={toMinimapX(node.position?.x ?? 0)}
            cy={toMinimapY(node.position?.y ?? 0)}
            r={3}
            className={`${
              node.state === 'selected'
                ? 'fill-violet-500'
                : node.state === 'hover'
                ? 'fill-cyan-500'
                : 'fill-zinc-400'
            }`}
          />
        ))}

        {/* Viewport rectangle */}
        <rect
          x={vpX}
          y={vpY}
          width={Math.max(vpW, 20)}
          height={Math.max(vpH, 15)}
          className="fill-violet-500/20 stroke-violet-500"
          strokeWidth={1}
          rx={2}
        />
      </svg>

      {/* Zoom indicator */}
      <div className="mt-1 text-center">
        <span className="text-[10px] text-zinc-500 font-mono">{Math.round(zoom)}%</span>
      </div>
    </div>
  )
}
