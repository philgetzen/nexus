import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MiniMap } from '@/components/graph/MiniMap'
import type { GraphNode, GraphEdge } from '@/types'

describe('MiniMap', () => {
  const sampleNodes: GraphNode[] = [
    { id: 'node-1', name: 'File 1', type: 'file', language: 'typescript', position: { x: 100, y: 100 }, connectionCount: 2, state: 'default' },
    { id: 'node-2', name: 'File 2', type: 'file', language: 'typescript', position: { x: 300, y: 200 }, connectionCount: 1, state: 'selected' },
    { id: 'node-3', name: 'File 3', type: 'file', language: 'typescript', position: { x: 200, y: 300 }, connectionCount: 1, state: 'default' },
  ]

  const sampleEdges: GraphEdge[] = [
    { id: 'edge-1', source: 'node-1', target: 'node-2', type: 'imports' },
    { id: 'edge-2', source: 'node-2', target: 'node-3', type: 'calls' },
  ]

  const defaultProps = {
    nodes: sampleNodes,
    edges: sampleEdges,
    viewportX: 0,
    viewportY: 0,
    viewportWidth: 800,
    viewportHeight: 600,
    zoom: 100,
  }

  it('should render minimap', () => {
    render(<MiniMap {...defaultProps} />)

    expect(screen.getByTestId('mini-map')).toBeInTheDocument()
  })

  it('should display empty state when no nodes', () => {
    render(<MiniMap {...defaultProps} nodes={[]} edges={[]} />)

    expect(screen.getByText('No nodes')).toBeInTheDocument()
  })

  it('should display current zoom level', () => {
    render(<MiniMap {...defaultProps} zoom={150} />)

    expect(screen.getByText('150%')).toBeInTheDocument()
  })

  it('should render node circles', () => {
    render(<MiniMap {...defaultProps} />)

    const minimap = screen.getByTestId('mini-map')
    const circles = minimap.querySelectorAll('circle')
    expect(circles.length).toBe(sampleNodes.length)
  })

  it('should render edge lines', () => {
    render(<MiniMap {...defaultProps} />)

    const minimap = screen.getByTestId('mini-map')
    const lines = minimap.querySelectorAll('line')
    expect(lines.length).toBe(sampleEdges.length)
  })

  it('should render viewport rectangle', () => {
    render(<MiniMap {...defaultProps} />)

    const minimap = screen.getByTestId('mini-map')
    // Should have background rect + viewport rect
    const rects = minimap.querySelectorAll('rect')
    expect(rects.length).toBeGreaterThanOrEqual(2)
  })

  it('should highlight selected nodes differently', () => {
    render(<MiniMap {...defaultProps} />)

    const minimap = screen.getByTestId('mini-map')
    const circles = minimap.querySelectorAll('circle')

    // Selected node should have violet fill
    const selectedCircle = Array.from(circles).find(c => c.classList.contains('fill-violet-500'))
    expect(selectedCircle).toBeInTheDocument()
  })

  it('should call onNavigate when minimap is clicked', () => {
    const onNavigate = vi.fn()
    render(<MiniMap {...defaultProps} onNavigate={onNavigate} />)

    const minimap = screen.getByTestId('mini-map')
    const svg = minimap.querySelector('svg')!

    // Mock getBoundingClientRect
    vi.spyOn(svg, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      top: 0,
      right: 160,
      bottom: 100,
      width: 160,
      height: 100,
      x: 0,
      y: 0,
      toJSON: () => ({})
    })

    fireEvent.click(svg, { clientX: 80, clientY: 50 })
    expect(onNavigate).toHaveBeenCalled()
  })

  it('should work without onNavigate callback', () => {
    render(<MiniMap {...defaultProps} />)

    const minimap = screen.getByTestId('mini-map')
    const svg = minimap.querySelector('svg')!

    // Should not throw when clicking without handler
    fireEvent.click(svg, { clientX: 80, clientY: 50 })
  })

  it('should handle different zoom levels', () => {
    const { rerender } = render(<MiniMap {...defaultProps} zoom={50} />)
    expect(screen.getByText('50%')).toBeInTheDocument()

    rerender(<MiniMap {...defaultProps} zoom={200} />)
    expect(screen.getByText('200%')).toBeInTheDocument()
  })
})
