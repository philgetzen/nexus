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

  // Pan state - use refs during drag for performance, sync to state on release
  const [panX, setPanX] = useState(0)
  const [panY, setPanY] = useState(0)
  const isPanningRef = useRef(false) // Use ref to avoid re-renders during pan
  const lastPanPos = useRef({ x: 0, y: 0 })
  const panRef = useRef({ x: 0, y: 0 })

  // Track if user is actively interacting (zoom/pan) - prevents React from overwriting DOM viewBox
  const isInteractingRef = useRef(false)
  // Skip the next state→DOM sync (used after interaction ends to prevent jump)
  const skipNextSyncRef = useRef(false)

  // Track if view is ready (auto-fit has been applied)
  const [isViewReady, setIsViewReady] = useState(false)

  // Create file and symbol lookup maps
  const fileMap = useMemo(
    () => Object.fromEntries(files.map((f) => [f.id, f])),
    [files]
  )
  const symbolMap = useMemo(
    () => Object.fromEntries(symbols.map((s) => [s.id, s])),
    [symbols]
  )

  // Create node lookup map for O(1) access during edge rendering
  const nodeMap = useMemo(
    () => new Map(filteredNodes.map((n) => [n.id, n])),
    [filteredNodes]
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

  // Apply layout based on selected algorithm
  useEffect(() => {
    console.log('[Layout] Effect triggered - allNodes:', allNodes.length, 'viewMode:', viewMode)

    if (allNodes.length === 0) {
      console.log('[Layout] Early return - no nodes')
      return
    }

    // Create a fingerprint based on node count and first/last node IDs
    const nodeFingerprint = `${allNodes.length}-${allNodes[0]?.id}-${allNodes[allNodes.length - 1]?.id}`
    console.log('[Layout] Fingerprint:', nodeFingerprint)

    // Skip if layout already applied for this exact configuration
    // But always re-run if nodes don't have positions
    const hasPositions = allNodes[0]?.position?.x !== undefined
    console.log('[Layout] hasPositions:', hasPositions, 'layoutApplied:', layoutAppliedRef.current)

    if (
      layoutAppliedRef.current &&
      layoutAppliedRef.current.algorithm === layoutAlgorithm &&
      layoutAppliedRef.current.nodeIds === nodeFingerprint &&
      hasPositions
    ) {
      console.log('[Layout] Skipping - already applied for this config')
      return
    }

    // Stop existing simulation if any
    if (simulationRef.current) {
      simulationRef.current.stop()
      simulationRef.current = null
    }

    // Mark layout as being applied and reset auto-fit
    layoutAppliedRef.current = { algorithm: layoutAlgorithm, nodeIds: nodeFingerprint }
    autoFitAppliedRef.current = null
    setIsViewReady(false) // Hide view until auto-fit completes

    // Create lookup map for O(1) node access (critical for performance with large graphs)
    const nodeMap = new Map(allNodes.map((n) => [n.id, n]))
    const nodeCount = allNodes.length

    // Filter edges to only include those where both source and target exist in current nodes
    const nodeIds = new Set(allNodes.map((n) => n.id))
    const validEdges = allEdges.filter((e) => nodeIds.has(e.source) && nodeIds.has(e.target))
    console.log('[Layout] Valid edges:', validEdges.length, 'of', allEdges.length)

    if (layoutAlgorithm === 'force-directed') {
      // Force-directed layout using D3-force
      const simNodes: SimNode[] = allNodes.map((n) => ({
        id: n.id,
        x: n.position?.x ?? width / 2 + (Math.random() - 0.5) * 200,
        y: n.position?.y ?? height / 2 + (Math.random() - 0.5) * 200,
      }))

      const simLinks: SimLink[] = validEdges.map((e) => ({
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


        simulation.alpha(1).restart()
      }

      simulationRef.current = simulation
    } else if (layoutAlgorithm === 'hierarchical') {
      // Hierarchical (tree) layout using dagre
      const g = new dagre.graphlib.Graph()

      // Adjust spacing for large graphs - make very compact for 1000+ nodes
      const nodesep = nodeCount > 1000 ? 5 : nodeCount > 500 ? 15 : 80
      const ranksep = nodeCount > 1000 ? 15 : nodeCount > 500 ? 30 : 100
      const nodeWidth = nodeCount > 1000 ? 20 : 60
      const nodeHeight = nodeCount > 1000 ? 10 : 30

      g.setGraph({ rankdir: 'TB', nodesep, ranksep })
      g.setDefaultEdgeLabel(() => ({}))

      // Add nodes
      allNodes.forEach((node) => {
        g.setNode(node.id, { width: nodeWidth, height: nodeHeight })
      })

      // Add edges
      validEdges.forEach((edge) => {
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
    } else if (layoutAlgorithm === 'radial') {
      // Radial layout - arrange nodes in concentric circles
      // Find root nodes (nodes with no incoming edges)
      const hasIncoming = new Set(validEdges.map((e) => e.target))
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
      validEdges.forEach((e) => {
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
    }

    return () => {
      if (simulationRef.current) {
        simulationRef.current.stop()
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- using fingerprint to track node changes
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

  // Memoize minimap nodes array to prevent MiniMap re-renders
  const minimapNodes = useMemo(
    () => filteredNodes.map((n) => ({ ...n, state: getNodeState(n.id) })),
    [filteredNodes, getNodeState]
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

  // Pan handlers - use refs during drag to avoid ALL re-renders
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 0 && svgRef.current) {
      // Left click - use refs only, no state updates
      isPanningRef.current = true
      isInteractingRef.current = true  // Block state→DOM sync while panning
      lastPanPos.current = { x: e.clientX, y: e.clientY }
      panRef.current = { x: panX, y: panY }
      // Update cursor via DOM
      svgRef.current.style.cursor = 'grabbing'
    }
  }, [panX, panY])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isPanningRef.current && svgRef.current) {
      // Get actual SVG dimensions
      const rect = svgRef.current.getBoundingClientRect()

      const dx = e.clientX - lastPanPos.current.x
      const dy = e.clientY - lastPanPos.current.y

      // Convert screen pixels to viewBox units
      // At 100% zoom, 1 screen pixel = 1 viewBox unit
      // At 50% zoom, 1 screen pixel = 2 viewBox units (viewBox is 2x larger)
      panRef.current.x -= dx / (zoomLevel / 100)
      panRef.current.y -= dy / (zoomLevel / 100)
      lastPanPos.current = { x: e.clientX, y: e.clientY }

      // Direct DOM update on viewBox - use actual SVG dimensions
      const viewBoxWidth = rect.width / (zoomLevel / 100)
      const viewBoxHeight = rect.height / (zoomLevel / 100)
      svgRef.current.setAttribute('viewBox',
        `${panRef.current.x} ${panRef.current.y} ${viewBoxWidth} ${viewBoxHeight}`)
    }
  }, [zoomLevel])

  const handleMouseUp = useCallback(() => {
    if (isPanningRef.current && svgRef.current) {
      isPanningRef.current = false
      isInteractingRef.current = false
      skipNextSyncRef.current = true  // Skip the sync since DOM already has correct values
      // Sync final position to state on release (single re-render)
      setPanX(panRef.current.x)
      setPanY(panRef.current.y)
      // Restore cursor
      svgRef.current.style.cursor = 'grab'
    }
  }, [])

  // Stable node event handlers to prevent re-renders
  const handleNodeHover = useCallback((id: string) => {
    hoverNode(id)
  }, [hoverNode])

  const handleNodeHoverEnd = useCallback((_id: string) => {
    hoverNode(null)
  }, [hoverNode])

  const handleNodeClick = useCallback((id: string) => {
    selectNode(id)
  }, [selectNode])

  const handleNodeDoubleClick = useCallback((id: string) => {
    // TODO: Open in editor via Tauri
    console.log('Open in editor:', id)
  }, [])

  // Zoom handlers - allow zooming out to 1% for very large/spread out graphs
  const handleZoomIn = useCallback(() => setZoomLevel(Math.min(zoomLevel * 1.2, 400)), [zoomLevel, setZoomLevel])
  const handleZoomOut = useCallback(() => setZoomLevel(Math.max(zoomLevel / 1.2, 1)), [zoomLevel, setZoomLevel])

  // Calculate and apply fit-to-view
  const handleFitToView = useCallback(() => {
    if (filteredNodes.length === 0) {
      setZoomLevel(100)
      setPanX(0)
      setPanY(0)
      return
    }

    // Get actual SVG dimensions (fall back to props if not available)
    const rect = svgRef.current?.getBoundingClientRect()
    const svgWidth = rect?.width || width
    const svgHeight = rect?.height || height

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
    const zoomX = svgWidth / graphWidth
    const zoomY = svgHeight / graphHeight
    const newZoom = Math.min(zoomX, zoomY, 1) * 100 // Cap at 100% max (don't zoom in past 100%)
    const clampedZoom = Math.max(1, Math.min(100, newZoom)) // Allow down to 1% for spread out graphs

    // Center the view on the graph
    const centerX = (minX + maxX) / 2
    const centerY = (minY + maxY) / 2
    const viewWidth = svgWidth / (clampedZoom / 100)
    const viewHeight = svgHeight / (clampedZoom / 100)

    setZoomLevel(clampedZoom)
    setPanX(centerX - viewWidth / 2)
    setPanY(centerY - viewHeight / 2)
  }, [filteredNodes, width, height, setZoomLevel])

  // Auto-fit when nodes change or layout completes
  useEffect(() => {
    console.log('[AutoFit] Effect triggered - filteredNodes:', filteredNodes.length)

    if (filteredNodes.length === 0) {
      console.log('[AutoFit] Early return - no filtered nodes')
      return
    }

    // Check if nodes have positions
    const hasPositions = filteredNodes.some(n => n.position?.x !== undefined)
    console.log('[AutoFit] hasPositions:', hasPositions)

    if (!hasPositions) {
      // No positions yet - wait for layout to run
      console.log('[AutoFit] Early return - no positions yet')
      return
    }

    // Create a fingerprint that includes view mode, node count and a position checksum
    const posSum = filteredNodes.slice(0, 5).reduce((acc, n) => acc + (n.position?.x ?? 0), 0)
    const fingerprint = `${viewMode}-${filteredNodes.length}-${layoutAlgorithm}-${posSum.toFixed(0)}`
    console.log('[AutoFit] Fingerprint:', fingerprint, 'Previous:', autoFitAppliedRef.current)

    // Only auto-fit once per unique fingerprint
    if (autoFitAppliedRef.current === fingerprint) {
      console.log('[AutoFit] Skipping - already applied')
      return
    }

    // Delay to ensure layout has settled (reduced since view is hidden until ready)
    console.log('[AutoFit] Scheduling auto-fit in 100ms')
    const timer = setTimeout(() => {
      console.log('[AutoFit] Applying auto-fit now')
      autoFitAppliedRef.current = fingerprint
      handleFitToView()
      setIsViewReady(true) // Show view after auto-fit
    }, 100)

    return () => clearTimeout(timer)
  }, [filteredNodes, layoutAlgorithm, viewMode, handleFitToView])

  // Scroll wheel zoom - direct DOM manipulation, sync state when done
  const zoomRef = useRef(zoomLevel)
  const zoomTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Keep refs in sync with state (for when state changes from other sources like auto-fit)
  useEffect(() => {
    zoomRef.current = zoomLevel
  }, [zoomLevel])

  useEffect(() => {
    panRef.current = { x: panX, y: panY }
  }, [panX, panY])

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    if (!svgRef.current) return

    // Block state→DOM sync while interacting
    isInteractingRef.current = true

    // Get actual SVG dimensions (not props - actual rendered size)
    const rect = svgRef.current.getBoundingClientRect()
    const svgWidth = rect.width
    const svgHeight = rect.height

    // Read current viewBox directly from DOM to ensure we have actual values
    const currentViewBox = svgRef.current.getAttribute('viewBox')
    if (!currentViewBox) return

    const [currentPanX, currentPanY, currentVBWidth, currentVBHeight] = currentViewBox.split(' ').map(Number)

    // Get cursor position relative to SVG element (as ratio 0-1)
    const cursorX = e.clientX - rect.left
    const cursorY = e.clientY - rect.top
    const cursorRatioX = cursorX / svgWidth
    const cursorRatioY = cursorY / svgHeight

    // Smooth zoom with good responsiveness
    const scrollAmount = Math.abs(e.deltaY)
    // Scale the zoom based on scroll intensity for natural feel
    // Mouse wheel: ~2-3% per tick, Trackpad: ~0.5-1% per tick
    const zoomIntensity = Math.min(scrollAmount / 500, 0.03) + 0.005
    const baseMultiplier = 1 - zoomIntensity
    // Zoom in = smaller viewBox, zoom out = larger viewBox
    const scaleFactor = e.deltaY > 0 ? (1 / baseMultiplier) : baseMultiplier

    // Calculate new viewBox dimensions directly (avoid zoom level round-trip)
    const newViewBoxWidth = currentVBWidth * scaleFactor
    const newViewBoxHeight = currentVBHeight * scaleFactor

    // Clamp to zoom limits (1% to 400%)
    const minVBWidth = svgWidth / 4    // 400% zoom
    const maxVBWidth = svgWidth * 100  // 1% zoom
    if (newViewBoxWidth < minVBWidth || newViewBoxWidth > maxVBWidth) {
      return // At zoom limit, don't process
    }

    // Calculate zoom for state (derived from viewBox, not the other way around)
    const newZoom = (svgWidth / newViewBoxWidth) * 100

    // Convert cursor position to graph coordinates (using current viewBox from DOM)
    const cursorGraphX = currentPanX + cursorRatioX * currentVBWidth
    const cursorGraphY = currentPanY + cursorRatioY * currentVBHeight

    // Calculate new pan so cursor stays over same graph point
    const newPanX = cursorGraphX - cursorRatioX * newViewBoxWidth
    const newPanY = cursorGraphY - cursorRatioY * newViewBoxHeight

    // Update refs for panning consistency
    zoomRef.current = newZoom
    panRef.current = { x: newPanX, y: newPanY }

    // Direct DOM update - no React re-render
    svgRef.current.setAttribute('viewBox',
      `${newPanX} ${newPanY} ${newViewBoxWidth} ${newViewBoxHeight}`)

    // Debounce the React state sync - only update after user stops scrolling
    if (zoomTimeoutRef.current) {
      clearTimeout(zoomTimeoutRef.current)
    }
    zoomTimeoutRef.current = setTimeout(() => {
      isInteractingRef.current = false
      skipNextSyncRef.current = true  // Skip the sync since DOM already has correct values
      setZoomLevel(newZoom)
      setPanX(newPanX)
      setPanY(newPanY)
    }, 150) // Sync state 150ms after last wheel event
  }, [setZoomLevel])

  // Minimap navigation
  const handleMinimapNavigate = (x: number, y: number) => {
    setPanX(x - width / 2)
    setPanY(y - height / 2)
  }

  // Sync state to DOM viewBox (only when not actively interacting)
  // This prevents React re-renders from overwriting direct DOM updates during zoom/pan
  useEffect(() => {
    // Skip if actively interacting
    if (isInteractingRef.current) return

    // Skip one sync after interaction ends (DOM already has correct values)
    if (skipNextSyncRef.current) {
      skipNextSyncRef.current = false
      return
    }

    if (svgRef.current) {
      // Use actual SVG dimensions for consistent viewBox calculations
      const rect = svgRef.current.getBoundingClientRect()
      const vbWidth = rect.width / (zoomLevel / 100)
      const vbHeight = rect.height / (zoomLevel / 100)
      svgRef.current.setAttribute('viewBox', `${panX} ${panY} ${vbWidth} ${vbHeight}`)
    }
  }, [zoomLevel, panX, panY])

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

      {/* Main SVG canvas - viewBox controlled via DOM only to prevent React re-render conflicts */}
      <svg
        ref={svgRef}
        width="100%"
        height="100%"
        style={{ cursor: 'grab' }}
        preserveAspectRatio="xMidYMid meet"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
      >
        {/* Edges (rendered first, behind nodes) */}
        <g className="edges" style={{ opacity: isViewReady ? 1 : 0, transition: 'opacity 150ms ease-in' }}>
          {filteredEdges.map((edge) => {
            const sourceNode = nodeMap.get(edge.source)
            const targetNode = nodeMap.get(edge.target)
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
        <g className="nodes" style={{ opacity: isViewReady ? 1 : 0, transition: 'opacity 150ms ease-in' }}>
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
              onHover={handleNodeHover}
              onHoverEnd={handleNodeHoverEnd}
              onClick={handleNodeClick}
              onDoubleClick={handleNodeDoubleClick}
            />
          ))}
        </g>

      </svg>

      {/* Top-right: Hover popover */}
      {hoveredPopover && (
        <div className="absolute top-4 right-4 z-20">
          <NodePopover content={hoveredPopover.content} />
        </div>
      )}

      {/* Top-left: View mode and Layout controls */}
      <div className="absolute top-4 left-4 flex items-center gap-2 z-20">
        <ViewModeSwitcher viewMode={viewMode} onViewModeChange={setViewMode} />
        <LayoutSwitcher layout={layoutAlgorithm} onLayoutChange={setLayoutAlgorithm} />
      </div>

      {/* Bottom-left: MiniMap */}
      <div className="absolute bottom-4 left-4 z-20">
        <MiniMap
          nodes={minimapNodes}
          edges={filteredEdges}
          viewportX={panX}
          viewportY={panY}
          viewportWidth={width}
          viewportHeight={height}
          zoom={zoomLevel}
          onNavigate={handleMinimapNavigate}
        />
      </div>

      {/* Bottom-right: Zoom controls */}
      <div className="absolute bottom-4 right-4 z-20">
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
