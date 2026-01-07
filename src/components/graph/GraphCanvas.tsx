import { useEffect, useRef, useMemo, useCallback, useState } from 'react'
import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCenter,
  forceCollide,
  type Simulation,
  type SimulationNodeDatum,
  type SimulationLinkDatum,
} from 'd3-force'
import dagre from 'dagre'
import { GraphNode } from './GraphNode'
import { GraphEdge } from './GraphEdge'
import { NodePopover, type NodePopoverContent } from './NodePopover'
import { MiniMap } from './MiniMap'
import { LayoutSwitcher } from './LayoutSwitcher'
import { ZoomControls } from './ZoomControls'
import { ViewModeSwitcher } from './ViewModeSwitcher'
import { useAppStore } from '@/stores/useAppStore'
import { useFilteredGraph } from '@/hooks/useFilteredGraph'
import type { GraphNode as GraphNodeType, File, Symbol } from '@/types'

interface GraphCanvasProps {
  files?: File[]
  symbols?: Symbol[]
  width?: number
  height?: number
}

// D3 simulation node type
interface SimNode extends SimulationNodeDatum {
  id: string
  x: number
  y: number
}

// D3 simulation link type
interface SimLink extends SimulationLinkDatum<SimNode> {
  id: string
  source: string | SimNode
  target: string | SimNode
}

export function GraphCanvas({
  files = [],
  symbols = [],
  width = 900,
  height = 600,
}: GraphCanvasProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const simulationRef = useRef<Simulation<SimNode, SimLink> | null>(null)

  const {
    nodes: allNodes,
    edges: allEdges,
    setNodes,
    selectedNodeId,
    hoveredNodeId,
    selectNode,
    hoverNode,
    zoomLevel,
    setZoomLevel,
    layoutAlgorithm,
    setLayoutAlgorithm,
    viewMode,
    setViewMode,
  } = useAppStore()

  // Get filtered nodes and edges based on current filter state and search query
  const {
    nodes: filteredNodes,
    edges: filteredEdges,
    searchMatchIds,
    hasSearchQuery,
  } = useFilteredGraph()

  // Pan state
  const [panX, setPanX] = useState(0)
  const [panY, setPanY] = useState(0)
  const [isPanning, setIsPanning] = useState(false)
  const lastPanPos = useRef({ x: 0, y: 0 })

  // Create file and symbol lookup maps
  const fileMap = useMemo(
    () => Object.fromEntries(files.map((f) => [f.id, f])),
    [files]
  )
  const symbolMap = useMemo(
    () => Object.fromEntries(symbols.map((s) => [s.id, s])),
    [symbols]
  )

  // Calculate connection counts for sizing (based on filtered edges)
  const connectionCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    filteredEdges.forEach((e) => {
      counts[e.source] = (counts[e.source] || 0) + 1
      counts[e.target] = (counts[e.target] || 0) + 1
    })
    return counts
  }, [filteredEdges])

  // Track if layout has been applied to prevent re-running
  const layoutAppliedRef = useRef<{ algorithm: string; nodeIds: string } | null>(null)

  // Track if we've auto-fitted for this graph
  const autoFitAppliedRef = useRef<string | null>(null)

  // Track layout completion for auto-fit timing
  const [layoutComplete, setLayoutComplete] = useState(false)

  // Apply layout based on selected algorithm
  useEffect(() => {
    if (allNodes.length === 0) return

    // Create a fingerprint of node IDs to detect when we have new/different nodes
    // Use first 10 + last 10 node IDs for efficiency
    const nodeIdSample = [
      ...allNodes.slice(0, 10).map(n => n.id),
      ...allNodes.slice(-10).map(n => n.id),
    ].join(',')

    // Skip if layout already applied for this algorithm and same nodes
    // But always re-run if nodes don't have positions (fresh from backend)
    const hasPositions = allNodes[0]?.position?.x !== undefined
    if (
      layoutAppliedRef.current &&
      layoutAppliedRef.current.algorithm === layoutAlgorithm &&
      layoutAppliedRef.current.nodeIds === nodeIdSample &&
      hasPositions
    ) {
      // Still mark as complete so auto-fit can run
      setLayoutComplete(true)
      return
    }

    // Stop existing simulation if any
    if (simulationRef.current) {
      simulationRef.current.stop()
      simulationRef.current = null
    }

    // Mark layout as being applied and reset auto-fit
    layoutAppliedRef.current = { algorithm: layoutAlgorithm, nodeIds: nodeIdSample }
    autoFitAppliedRef.current = null
    setLayoutComplete(false)

    // Create lookup map for O(1) node access (critical for performance with large graphs)
    const nodeMap = new Map(allNodes.map((n) => [n.id, n]))
    const nodeCount = allNodes.length

    if (layoutAlgorithm === 'force-directed') {
      // Force-directed layout using D3-force
      const simNodes: SimNode[] = allNodes.map((n) => ({
        id: n.id,
        x: n.position?.x ?? width / 2 + (Math.random() - 0.5) * 200,
        y: n.position?.y ?? height / 2 + (Math.random() - 0.5) * 200,
      }))

      const simLinks: SimLink[] = allEdges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
      }))

      // Adjust forces for large graphs - keep them compact
      const chargeStrength = nodeCount > 1000 ? -30 : nodeCount > 500 ? -50 : -300
      const linkDistance = nodeCount > 1000 ? 20 : nodeCount > 500 ? 30 : 100
      const collideRadius = nodeCount > 1000 ? 8 : nodeCount > 500 ? 15 : 50

      const simulation = forceSimulation<SimNode>(simNodes)
        .force(
          'link',
          forceLink<SimNode, SimLink>(simLinks)
            .id((d) => d.id)
            .distance(linkDistance)
        )
        .force('charge', forceManyBody().strength(chargeStrength))
        .force('center', forceCenter(width / 2, height / 2))
        .force('collide', forceCollide(collideRadius))
        .alphaDecay(nodeCount > 500 ? 0.05 : 0.0228) // Faster decay for large graphs

      // For large graphs, show initial positions immediately then refine
      if (nodeCount > 300) {
        // Show nodes at initial random positions immediately
        const initialNodes: GraphNodeType[] = simNodes.map((sn) => {
          const originalNode = nodeMap.get(sn.id)
          return {
            ...originalNode!,
            position: { x: sn.x, y: sn.y },
          }
        })
        setNodes(initialNodes)

        // Run simulation in chunks to avoid blocking UI
        simulation.stop()
        const totalIterations = 50 // Reduced iterations
        const chunkSize = 10
        let currentIteration = 0

        const runChunk = () => {
          const endIteration = Math.min(currentIteration + chunkSize, totalIterations)
          for (let i = currentIteration; i < endIteration; i++) {
            simulation.tick()
          }
          currentIteration = endIteration

          // Continue if more iterations needed, otherwise update React state ONCE
          if (currentIteration < totalIterations) {
            requestAnimationFrame(runChunk)
          } else {
            // Only update React state at the very end to avoid multiple expensive re-renders
            const finalNodes: GraphNodeType[] = simNodes.map((sn) => {
              const originalNode = nodeMap.get(sn.id)
              return {
                ...originalNode!,
                position: { x: sn.x, y: sn.y },
              }
            })
            setNodes(finalNodes)
            setLayoutComplete(true)
          }
        }

        // Start the chunked simulation after a brief delay
        requestAnimationFrame(runChunk)
      } else {
        // For smaller graphs, animate normally
        let lastUpdateTime = 0
        const updateInterval = 50

        simulation.on('tick', () => {
          const now = Date.now()
          if (now - lastUpdateTime < updateInterval) return
          lastUpdateTime = now

          const updatedNodes: GraphNodeType[] = simNodes.map((sn) => {
            const originalNode = nodeMap.get(sn.id)
            return {
              ...originalNode!,
              position: { x: sn.x, y: sn.y },
            }
          })
          setNodes(updatedNodes)
        })

        simulation.on('end', () => {
          setLayoutComplete(true)
        })

        simulation.alpha(1).restart()
      }

      simulationRef.current = simulation
    } else if (layoutAlgorithm === 'hierarchical') {
      // Hierarchical (tree) layout using dagre
      const g = new dagre.graphlib.Graph()

      // Adjust spacing for large graphs (nodeCount already defined above)
      const nodesep = nodeCount > 500 ? 30 : 80
      const ranksep = nodeCount > 500 ? 50 : 100

      g.setGraph({ rankdir: 'TB', nodesep, ranksep })
      g.setDefaultEdgeLabel(() => ({}))

      // Add nodes
      allNodes.forEach((node) => {
        g.setNode(node.id, { width: 60, height: 30 })
      })

      // Add edges
      allEdges.forEach((edge) => {
        g.setEdge(edge.source, edge.target)
      })

      // Run dagre layout
      dagre.layout(g)

      // Update node positions using nodeMap for O(1) access
      const updatedNodes: GraphNodeType[] = allNodes.map((node) => {
        const dagreNode = g.node(node.id)
        const originalNode = nodeMap.get(node.id)
        return {
          ...originalNode!,
          position: {
            x: dagreNode ? dagreNode.x : width / 2,
            y: dagreNode ? dagreNode.y : height / 2,
          },
        }
      })
      setNodes(updatedNodes)
      setLayoutComplete(true)
    } else if (layoutAlgorithm === 'radial') {
      // Radial layout - arrange nodes in concentric circles
      // Find root nodes (nodes with no incoming edges)
      const hasIncoming = new Set(allEdges.map((e) => e.target))
      const rootNodes = allNodes.filter((n) => !hasIncoming.has(n.id))
      const centerX = width / 2
      const centerY = height / 2

      // BFS to assign levels
      const levels: Map<string, number> = new Map()
      const queue: string[] = []

      // Initialize root nodes at level 0
      rootNodes.forEach((n) => {
        levels.set(n.id, 0)
        queue.push(n.id)
      })

      // If no root nodes, use all nodes as roots
      if (rootNodes.length === 0) {
        allNodes.forEach((n) => {
          if (!levels.has(n.id)) {
            levels.set(n.id, 0)
            queue.push(n.id)
          }
        })
      }

      // Build edge lookup for faster BFS traversal
      const outgoingEdges = new Map<string, string[]>()
      allEdges.forEach((e) => {
        if (!outgoingEdges.has(e.source)) {
          outgoingEdges.set(e.source, [])
        }
        outgoingEdges.get(e.source)!.push(e.target)
      })

      // BFS traversal
      while (queue.length > 0) {
        const nodeId = queue.shift()!
        const currentLevel = levels.get(nodeId)!

        // Find children (nodes this node points to)
        const children = outgoingEdges.get(nodeId) || []
        children.forEach((targetId) => {
          if (!levels.has(targetId)) {
            levels.set(targetId, currentLevel + 1)
            queue.push(targetId)
          }
        })
      }

      // Assign remaining unvisited nodes to level 0
      allNodes.forEach((n) => {
        if (!levels.has(n.id)) {
          levels.set(n.id, 0)
        }
      })

      // Group nodes by level
      const nodesByLevel: Map<number, string[]> = new Map()
      allNodes.forEach((node) => {
        const level = levels.get(node.id)!
        if (!nodesByLevel.has(level)) {
          nodesByLevel.set(level, [])
        }
        nodesByLevel.get(level)!.push(node.id)
      })

      // Calculate positions - adjust radius for large graphs (nodeCount already defined above)
      const baseRadius = nodeCount > 500 ? 80 : 150

      const updatedNodes: GraphNodeType[] = allNodes.map((node) => {
        const originalNode = nodeMap.get(node.id)!
        const level = levels.get(node.id)!
        const nodesAtLevel = nodesByLevel.get(level)!
        const indexAtLevel = nodesAtLevel.indexOf(node.id)
        const countAtLevel = nodesAtLevel.length

        if (level === 0 && countAtLevel === 1) {
          // Single root at center
          return { ...originalNode, position: { x: centerX, y: centerY } }
        }

        const radius = level === 0 ? 0 : baseRadius * level
        const angleStep = (2 * Math.PI) / countAtLevel
        const angle = indexAtLevel * angleStep - Math.PI / 2 // Start from top

        return {
          ...originalNode,
          position: {
            x: centerX + radius * Math.cos(angle),
            y: centerY + radius * Math.sin(angle),
          },
        }
      })

      setNodes(updatedNodes)
      setLayoutComplete(true)
    }

    return () => {
      if (simulationRef.current) {
        simulationRef.current.stop()
      }
    }
  }, [allNodes.length, allEdges.length, width, height, layoutAlgorithm, setNodes])

  // Get node state based on selection and search
  const getNodeState = useCallback(
    (nodeId: string): 'default' | 'hover' | 'selected' | 'faded' | 'search-match' => {
      if (nodeId === selectedNodeId) return 'selected'
      if (nodeId === hoveredNodeId) return 'hover'

      // When searching, highlight matches and fade non-matches
      if (hasSearchQuery) {
        if (searchMatchIds.has(nodeId)) return 'search-match'
        return 'faded'
      }

      // When a node is selected, fade unconnected nodes
      if (selectedNodeId) {
        const isConnected = filteredEdges.some(
          (e) =>
            (e.source === selectedNodeId && e.target === nodeId) ||
            (e.target === selectedNodeId && e.source === nodeId)
        )
        if (!isConnected && nodeId !== selectedNodeId) return 'faded'
      }

      return 'default'
    },
    [selectedNodeId, hoveredNodeId, filteredEdges, hasSearchQuery, searchMatchIds]
  )

  // Check if edge is highlighted
  const isEdgeHighlighted = useCallback(
    (sourceId: string, targetId: string) => {
      return sourceId === selectedNodeId || targetId === selectedNodeId
    },
    [selectedNodeId]
  )

  // Calculate popover content for hovered node
  const hoveredPopover = useMemo((): {
    content: NodePopoverContent
    x: number
    y: number
  } | null => {
    if (!hoveredNodeId || hoveredNodeId === selectedNodeId) return null

    const node = filteredNodes.find((n) => n.id === hoveredNodeId)
    if (!node) return null

    const file = fileMap[hoveredNodeId]
    const symbol = symbolMap[hoveredNodeId]

    const incoming = filteredEdges.filter((e) => e.target === hoveredNodeId).length
    const outgoing = filteredEdges.filter((e) => e.source === hoveredNodeId).length

    if (file) {
      return {
        content: {
          name: file.name,
          type: 'file',
          path: file.path,
          language: file.language,
          incomingCount: incoming,
          outgoingCount: outgoing,
          lineInfo: file.lineCount,
        },
        x: node.position?.x ?? 0,
        y: node.position?.y ?? 0,
      }
    }

    if (symbol) {
      return {
        content: {
          name: symbol.name,
          type: symbol.kind,
          path: `${fileMap[symbol.fileId]?.path || 'unknown'}:${symbol.line}`,
          incomingCount: incoming,
          outgoingCount: outgoing,
          lineInfo: symbol.line,
        },
        x: node.position?.x ?? 0,
        y: node.position?.y ?? 0,
      }
    }

    // Fallback for nodes without file/symbol data
    return {
      content: {
        name: node.name,
        type: node.type === 'file' ? 'file' : node.symbolKind || 'function',
        path: '',
        language: node.language,
        incomingCount: incoming,
        outgoingCount: outgoing,
        lineInfo: 0,
      },
      x: node.position?.x ?? 0,
      y: node.position?.y ?? 0,
    }
  }, [hoveredNodeId, selectedNodeId, filteredNodes, filteredEdges, fileMap, symbolMap])

  // Pan handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0) {
      // Left click
      setIsPanning(true)
      lastPanPos.current = { x: e.clientX, y: e.clientY }
    }
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      const dx = e.clientX - lastPanPos.current.x
      const dy = e.clientY - lastPanPos.current.y
      setPanX((prev) => prev - dx / (zoomLevel / 100))
      setPanY((prev) => prev - dy / (zoomLevel / 100))
      lastPanPos.current = { x: e.clientX, y: e.clientY }
    }
  }

  const handleMouseUp = () => {
    setIsPanning(false)
  }

  // Zoom handlers - allow zooming out to 1% for very large/spread out graphs
  const handleZoomIn = () => setZoomLevel(Math.min(zoomLevel * 1.2, 400))
  const handleZoomOut = () => setZoomLevel(Math.max(zoomLevel / 1.2, 1))

  // Calculate and apply fit-to-view
  const handleFitToView = useCallback(() => {
    if (filteredNodes.length === 0) {
      setZoomLevel(100)
      setPanX(0)
      setPanY(0)
      return
    }

    // Calculate bounding box of all nodes
    let minX = Infinity, maxX = -Infinity
    let minY = Infinity, maxY = -Infinity

    filteredNodes.forEach((node) => {
      const x = node.position?.x ?? 0
      const y = node.position?.y ?? 0
      minX = Math.min(minX, x)
      maxX = Math.max(maxX, x)
      minY = Math.min(minY, y)
      maxY = Math.max(maxY, y)
    })

    // Add padding
    const padding = 100
    minX -= padding
    maxX += padding
    minY -= padding
    maxY += padding

    const graphWidth = maxX - minX
    const graphHeight = maxY - minY

    // Calculate zoom to fit - allow very low zoom for large/spread graphs
    const zoomX = width / graphWidth
    const zoomY = height / graphHeight
    const newZoom = Math.min(zoomX, zoomY, 1) * 100 // Cap at 100% max (don't zoom in past 100%)
    const clampedZoom = Math.max(1, Math.min(100, newZoom)) // Allow down to 1% for spread out graphs

    // Center the view on the graph
    const centerX = (minX + maxX) / 2
    const centerY = (minY + maxY) / 2
    const viewWidth = width / (clampedZoom / 100)
    const viewHeight = height / (clampedZoom / 100)

    setZoomLevel(clampedZoom)
    setPanX(centerX - viewWidth / 2)
    setPanY(centerY - viewHeight / 2)
  }, [filteredNodes, width, height, setZoomLevel])

  // Compute stable fingerprint for auto-fit tracking
  const nodesFingerprint = useMemo(() => {
    if (filteredNodes.length === 0) return ''
    const hasPositions = filteredNodes.some(n => n.position?.x !== undefined)
    const firstNodePos = filteredNodes[0]?.position
    return `${filteredNodes.length}-${hasPositions}-${firstNodePos?.x?.toFixed(0) ?? 'none'}`
  }, [filteredNodes])

  // Auto-fit when layout completes or nodes get positions
  useEffect(() => {
    if (filteredNodes.length === 0) return

    // Check if nodes have positions
    const hasPositions = filteredNodes.some(n => n.position?.x !== undefined)
    if (!hasPositions) return

    // Create a fingerprint to detect new graph data
    const fingerprint = `${nodesFingerprint}-${layoutAlgorithm}`

    // Only auto-fit once per unique fingerprint
    if (autoFitAppliedRef.current === fingerprint) return

    // Delay to ensure layout has settled
    const timer = setTimeout(() => {
      autoFitAppliedRef.current = fingerprint
      handleFitToView()
    }, 150)

    return () => clearTimeout(timer)
  }, [nodesFingerprint, layoutAlgorithm, handleFitToView, filteredNodes])

  // Scroll wheel zoom - allow zooming out to 1% for spread out graphs
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? 0.9 : 1.1 // Zoom out or in
    const newZoom = Math.max(1, Math.min(400, zoomLevel * delta))
    setZoomLevel(newZoom)
  }

  // Minimap navigation
  const handleMinimapNavigate = (x: number, y: number) => {
    setPanX(x - width / 2)
    setPanY(y - height / 2)
  }

  // Calculate viewBox based on zoom and pan
  const zoomDecimal = zoomLevel / 100
  const viewBoxWidth = width / zoomDecimal
  const viewBoxHeight = height / zoomDecimal
  const viewBox = `${panX} ${panY} ${viewBoxWidth} ${viewBoxHeight}`

  return (
    <div className="relative w-full h-full bg-zinc-950 overflow-hidden" data-testid="graph-canvas">
      {/* Subtle grid background */}
      <div
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(to right, rgb(161, 161, 170) 1px, transparent 1px),
            linear-gradient(to bottom, rgb(161, 161, 170) 1px, transparent 1px)
          `,
          backgroundSize: '40px 40px',
        }}
      />

      {/* Main SVG canvas */}
      <svg
        ref={svgRef}
        width="100%"
        height="100%"
        viewBox={viewBox}
        className={isPanning ? 'cursor-grabbing' : 'cursor-grab'}
        preserveAspectRatio="xMidYMid meet"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
      >
        {/* Edges (rendered first, behind nodes) */}
        <g className="edges">
          {filteredEdges.map((edge) => {
            const sourceNode = filteredNodes.find((n) => n.id === edge.source)
            const targetNode = filteredNodes.find((n) => n.id === edge.target)
            if (!sourceNode || !targetNode) return null

            const highlighted = isEdgeHighlighted(edge.source, edge.target)
            const faded = (selectedNodeId !== null && !highlighted) || hasSearchQuery

            return (
              <GraphEdge
                key={edge.id}
                id={edge.id}
                sourceX={sourceNode.position?.x ?? 0}
                sourceY={sourceNode.position?.y ?? 0}
                targetX={targetNode.position?.x ?? 0}
                targetY={targetNode.position?.y ?? 0}
                kind={edge.type}
                isHighlighted={highlighted}
                isFaded={faded}
              />
            )
          })}
        </g>

        {/* Nodes */}
        <g className="nodes">
          {filteredNodes.map((node) => (
            <GraphNode
              key={node.id}
              id={node.id}
              x={node.position?.x ?? 0}
              y={node.position?.y ?? 0}
              state={getNodeState(node.id)}
              name={node.name}
              type={node.type}
              language={node.language}
              symbolKind={node.symbolKind}
              connectionCount={connectionCounts[node.id] || 0}
              onHover={() => hoverNode(node.id)}
              onHoverEnd={() => hoverNode(null)}
              onClick={() => selectNode(node.id)}
              onDoubleClick={() => {
                // TODO: Open in editor via Tauri
                console.log('Open in editor:', node.id)
              }}
            />
          ))}
        </g>

        {/* Hover popover */}
        {hoveredPopover && (
          <NodePopover
            content={hoveredPopover.content}
            x={hoveredPopover.x}
            y={hoveredPopover.y}
          />
        )}
      </svg>

      {/* Top-left: View mode and Layout controls */}
      <div className="absolute top-4 left-4 flex items-center gap-2 z-20">
        <ViewModeSwitcher viewMode={viewMode} onViewModeChange={setViewMode} />
        <LayoutSwitcher layout={layoutAlgorithm} onLayoutChange={setLayoutAlgorithm} />
      </div>

      {/* Bottom-right: MiniMap + Zoom controls combined */}
      <div className="absolute bottom-4 right-4 z-20 flex items-end gap-2">
        <MiniMap
          nodes={filteredNodes.map((n) => ({ ...n, state: getNodeState(n.id) }))}
          edges={filteredEdges}
          viewportX={panX}
          viewportY={panY}
          viewportWidth={width}
          viewportHeight={height}
          zoom={zoomLevel}
          onNavigate={handleMinimapNavigate}
        />
        <ZoomControls
          zoom={zoomLevel}
          onZoomIn={handleZoomIn}
          onZoomOut={handleZoomOut}
          onFitToView={handleFitToView}
        />
      </div>

      {/* Empty state */}
      {allNodes.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center text-zinc-500">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-zinc-800 flex items-center justify-center">
              <svg
                className="w-8 h-8"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                />
              </svg>
            </div>
            <p className="text-sm">No graph data</p>
            <p className="text-xs mt-1">Open a project to visualize its structure</p>
          </div>
        </div>
      )}
    </div>
  )
}
