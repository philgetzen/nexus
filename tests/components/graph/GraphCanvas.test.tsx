import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { GraphCanvas } from '@/components/graph/GraphCanvas'
import { useAppStore } from '@/stores/useAppStore'
import type { GraphNode, GraphEdge, File } from '@/types'

// Mock the store
vi.mock('@/stores/useAppStore')

describe('GraphCanvas', () => {
  const mockNodes: GraphNode[] = [
    { id: 'node-1', name: 'App.tsx', type: 'file', language: 'typescript', position: { x: 100, y: 100 }, connectionCount: 2, state: 'default' },
    { id: 'node-2', name: 'utils.ts', type: 'file', language: 'typescript', position: { x: 300, y: 200 }, connectionCount: 1, state: 'default' },
  ]

  const mockEdges: GraphEdge[] = [
    { id: 'edge-1', source: 'node-1', target: 'node-2', type: 'imports' },
  ]

  const mockFiles: File[] = [
    { id: 'node-1', name: 'App.tsx', path: 'src/App.tsx', absolutePath: '/src/App.tsx', language: 'typescript', lineCount: 100, isHidden: false, projectId: 'demo' },
    { id: 'node-2', name: 'utils.ts', path: 'src/utils.ts', absolutePath: '/src/utils.ts', language: 'typescript', lineCount: 50, isHidden: false, projectId: 'demo' },
  ]

  const mockSetNodes = vi.fn()
  const mockSelectNode = vi.fn()
  const mockHoverNode = vi.fn()
  const mockSetZoomLevel = vi.fn()
  const mockSetLayoutAlgorithm = vi.fn()
  const mockSetViewMode = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()

    vi.mocked(useAppStore).mockReturnValue({
      nodes: mockNodes,
      edges: mockEdges,
      setNodes: mockSetNodes,
      selectedNodeId: null,
      hoveredNodeId: null,
      selectNode: mockSelectNode,
      hoverNode: mockHoverNode,
      zoomLevel: 100,
      setZoomLevel: mockSetZoomLevel,
      layoutAlgorithm: 'force-directed',
      setLayoutAlgorithm: mockSetLayoutAlgorithm,
      viewMode: 'file',
      setViewMode: mockSetViewMode,
    } as ReturnType<typeof useAppStore>)
  })

  it('should render graph canvas', () => {
    render(<GraphCanvas files={mockFiles} />)

    expect(screen.getByTestId('graph-canvas')).toBeInTheDocument()
  })

  it('should render nodes', () => {
    render(<GraphCanvas files={mockFiles} />)

    expect(screen.getByTestId('graph-node-node-1')).toBeInTheDocument()
    expect(screen.getByTestId('graph-node-node-2')).toBeInTheDocument()
  })

  it('should render edges', () => {
    render(<GraphCanvas files={mockFiles} />)

    expect(screen.getByTestId('graph-edge-edge-1')).toBeInTheDocument()
  })

  it('should display node and edge counts', () => {
    render(<GraphCanvas files={mockFiles} />)

    expect(screen.getByText('2')).toBeInTheDocument() // 2 nodes
    expect(screen.getByText('nodes')).toBeInTheDocument()
    expect(screen.getByText('1')).toBeInTheDocument() // 1 edge
    expect(screen.getByText('edges')).toBeInTheDocument()
  })

  it('should render zoom controls', () => {
    render(<GraphCanvas files={mockFiles} />)

    expect(screen.getByTestId('zoom-controls')).toBeInTheDocument()
  })

  it('should render minimap', () => {
    render(<GraphCanvas files={mockFiles} />)

    expect(screen.getByTestId('mini-map')).toBeInTheDocument()
  })

  it('should render layout switcher', () => {
    render(<GraphCanvas files={mockFiles} />)

    expect(screen.getByTestId('layout-switcher')).toBeInTheDocument()
  })

  it('should render view mode switcher', () => {
    render(<GraphCanvas files={mockFiles} />)

    expect(screen.getByTestId('view-mode-switcher')).toBeInTheDocument()
  })

  it('should show empty state when no nodes', () => {
    vi.mocked(useAppStore).mockReturnValue({
      nodes: [],
      edges: [],
      setNodes: mockSetNodes,
      selectedNodeId: null,
      hoveredNodeId: null,
      selectNode: mockSelectNode,
      hoverNode: mockHoverNode,
      zoomLevel: 100,
      setZoomLevel: mockSetZoomLevel,
      layoutAlgorithm: 'force-directed',
      setLayoutAlgorithm: mockSetLayoutAlgorithm,
      viewMode: 'file',
      setViewMode: mockSetViewMode,
    } as ReturnType<typeof useAppStore>)

    render(<GraphCanvas />)

    expect(screen.getByText('No graph data')).toBeInTheDocument()
    expect(screen.getByText('Open a project to visualize its structure')).toBeInTheDocument()
  })

  it('should call selectNode when a node is clicked', () => {
    render(<GraphCanvas files={mockFiles} />)

    fireEvent.click(screen.getByTestId('graph-node-node-1'))
    expect(mockSelectNode).toHaveBeenCalledWith('node-1')
  })

  it('should call hoverNode when mouse enters a node', () => {
    render(<GraphCanvas files={mockFiles} />)

    fireEvent.mouseEnter(screen.getByTestId('graph-node-node-1'))
    expect(mockHoverNode).toHaveBeenCalledWith('node-1')
  })

  it('should call hoverNode with null when mouse leaves a node', () => {
    render(<GraphCanvas files={mockFiles} />)

    fireEvent.mouseLeave(screen.getByTestId('graph-node-node-1'))
    expect(mockHoverNode).toHaveBeenCalledWith(null)
  })

  it('should call setZoomLevel when zoom in is clicked', () => {
    render(<GraphCanvas files={mockFiles} />)

    fireEvent.click(screen.getByLabelText('Zoom in'))
    expect(mockSetZoomLevel).toHaveBeenCalled()
  })

  it('should call setZoomLevel when zoom out is clicked', () => {
    render(<GraphCanvas files={mockFiles} />)

    fireEvent.click(screen.getByLabelText('Zoom out'))
    expect(mockSetZoomLevel).toHaveBeenCalled()
  })

  it('should call setZoomLevel when fit to view is clicked', () => {
    render(<GraphCanvas files={mockFiles} />)

    fireEvent.click(screen.getByLabelText('Fit to view'))
    expect(mockSetZoomLevel).toHaveBeenCalledWith(100)
  })

  it('should call setLayoutAlgorithm when layout is changed', () => {
    render(<GraphCanvas files={mockFiles} />)

    fireEvent.click(screen.getByLabelText('Tree layout'))
    expect(mockSetLayoutAlgorithm).toHaveBeenCalledWith('hierarchical')
  })

  it('should call setViewMode when view mode is changed', () => {
    render(<GraphCanvas files={mockFiles} />)

    fireEvent.click(screen.getByLabelText('Symbol view'))
    expect(mockSetViewMode).toHaveBeenCalledWith('symbol')
  })

  it('should highlight connected edges when a node is selected', () => {
    vi.mocked(useAppStore).mockReturnValue({
      nodes: mockNodes,
      edges: mockEdges,
      setNodes: mockSetNodes,
      selectedNodeId: 'node-1',
      hoveredNodeId: null,
      selectNode: mockSelectNode,
      hoverNode: mockHoverNode,
      zoomLevel: 100,
      setZoomLevel: mockSetZoomLevel,
      layoutAlgorithm: 'force-directed',
      setLayoutAlgorithm: mockSetLayoutAlgorithm,
      viewMode: 'file',
      setViewMode: mockSetViewMode,
    } as ReturnType<typeof useAppStore>)

    render(<GraphCanvas files={mockFiles} />)

    // Edge should be highlighted when connected to selected node
    const edge = screen.getByTestId('graph-edge-edge-1')
    // Highlighted edges have two lines (glow effect)
    expect(edge.querySelectorAll('line').length).toBe(2)
  })

  it('should apply selected state to selected node', () => {
    vi.mocked(useAppStore).mockReturnValue({
      nodes: mockNodes,
      edges: mockEdges,
      setNodes: mockSetNodes,
      selectedNodeId: 'node-1',
      hoveredNodeId: null,
      selectNode: mockSelectNode,
      hoverNode: mockHoverNode,
      zoomLevel: 100,
      setZoomLevel: mockSetZoomLevel,
      layoutAlgorithm: 'force-directed',
      setLayoutAlgorithm: mockSetLayoutAlgorithm,
      viewMode: 'file',
      setViewMode: mockSetViewMode,
    } as ReturnType<typeof useAppStore>)

    render(<GraphCanvas files={mockFiles} />)

    const selectedNode = screen.getByTestId('graph-node-node-1')
    // Selected nodes have glow effect (extra circle)
    expect(selectedNode.querySelectorAll('circle').length).toBeGreaterThan(1)
  })

  it('should fade non-connected nodes when a node is selected', () => {
    const threeNodes: GraphNode[] = [
      ...mockNodes,
      { id: 'node-3', name: 'other.ts', type: 'file', language: 'typescript', position: { x: 500, y: 100 }, connectionCount: 0, state: 'default' },
    ]

    vi.mocked(useAppStore).mockReturnValue({
      nodes: threeNodes,
      edges: mockEdges,
      setNodes: mockSetNodes,
      selectedNodeId: 'node-1',
      hoveredNodeId: null,
      selectNode: mockSelectNode,
      hoverNode: mockHoverNode,
      zoomLevel: 100,
      setZoomLevel: mockSetZoomLevel,
      layoutAlgorithm: 'force-directed',
      setLayoutAlgorithm: mockSetLayoutAlgorithm,
      viewMode: 'file',
      setViewMode: mockSetViewMode,
    } as ReturnType<typeof useAppStore>)

    render(<GraphCanvas files={mockFiles} />)

    // Node 3 is not connected to selected node 1, should be faded
    const fadedNode = screen.getByTestId('graph-node-node-3')
    expect(fadedNode.getAttribute('opacity')).toBe('0.3')
  })

  it('should change cursor to grabbing when panning', () => {
    render(<GraphCanvas files={mockFiles} />)

    const canvas = screen.getByTestId('graph-canvas')
    const svg = canvas.querySelector('svg')!

    expect(svg).toHaveClass('cursor-grab')

    fireEvent.mouseDown(svg, { button: 0 })
    expect(svg).toHaveClass('cursor-grabbing')

    fireEvent.mouseUp(svg)
    expect(svg).toHaveClass('cursor-grab')
  })
})
