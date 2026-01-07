import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { GraphEdge } from '@/components/graph/GraphEdge'

describe('GraphEdge', () => {
  const defaultProps = {
    id: 'edge-1',
    sourceX: 100,
    sourceY: 100,
    targetX: 200,
    targetY: 200,
    kind: 'imports' as const,
  }

  it('should render an edge with testid', () => {
    render(
      <svg>
        <GraphEdge {...defaultProps} />
      </svg>
    )

    expect(screen.getByTestId('graph-edge-edge-1')).toBeInTheDocument()
  })

  it('should render line and arrow head', () => {
    render(
      <svg>
        <GraphEdge {...defaultProps} />
      </svg>
    )

    const edge = screen.getByTestId('graph-edge-edge-1')
    expect(edge.querySelector('line')).toBeInTheDocument()
    expect(edge.querySelector('polygon')).toBeInTheDocument()
  })

  it('should not render when source and target are same position', () => {
    render(
      <svg>
        <GraphEdge {...defaultProps} sourceX={100} sourceY={100} targetX={100} targetY={100} />
      </svg>
    )

    expect(screen.queryByTestId('graph-edge-edge-1')).not.toBeInTheDocument()
  })

  it('should render with imports kind styling', () => {
    render(
      <svg>
        <GraphEdge {...defaultProps} kind="imports" />
      </svg>
    )

    const edge = screen.getByTestId('graph-edge-edge-1')
    const line = edge.querySelector('line')
    expect(line).toHaveClass('stroke-cyan-500')
  })

  it('should render with calls kind styling', () => {
    render(
      <svg>
        <GraphEdge {...defaultProps} kind="calls" />
      </svg>
    )

    const edge = screen.getByTestId('graph-edge-edge-1')
    const line = edge.querySelector('line')
    expect(line).toHaveClass('stroke-violet-500')
  })

  it('should render with extends kind styling', () => {
    render(
      <svg>
        <GraphEdge {...defaultProps} kind="extends" />
      </svg>
    )

    const edge = screen.getByTestId('graph-edge-edge-1')
    const line = edge.querySelector('line')
    expect(line).toHaveClass('stroke-amber-500')
  })

  it('should apply highlighted styling when isHighlighted is true', () => {
    render(
      <svg>
        <GraphEdge {...defaultProps} isHighlighted />
      </svg>
    )

    const edge = screen.getByTestId('graph-edge-edge-1')
    // Highlighted edges have two lines (glow effect)
    const lines = edge.querySelectorAll('line')
    expect(lines.length).toBe(2)
  })

  it('should apply faded styling when isFaded is true', () => {
    render(
      <svg>
        <GraphEdge {...defaultProps} isFaded />
      </svg>
    )

    const edge = screen.getByTestId('graph-edge-edge-1')
    expect(edge.getAttribute('opacity')).toBe('0.2')
  })

  it('should render with default opacity when not highlighted or faded', () => {
    render(
      <svg>
        <GraphEdge {...defaultProps} />
      </svg>
    )

    const edge = screen.getByTestId('graph-edge-edge-1')
    expect(edge.getAttribute('opacity')).toBe('1')
  })
})
