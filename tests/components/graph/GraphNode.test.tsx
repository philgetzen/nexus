import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { GraphNode } from '@/components/graph/GraphNode'

describe('GraphNode', () => {
  const defaultProps = {
    id: 'node-1',
    x: 100,
    y: 200,
    state: 'default' as const,
    name: 'test-file.ts',
    type: 'file' as const,
    language: 'typescript' as const,
    connectionCount: 3,
  }

  it('should render a file node', () => {
    render(
      <svg>
        <GraphNode {...defaultProps} />
      </svg>
    )

    expect(screen.getByTestId('graph-node-node-1')).toBeInTheDocument()
    expect(screen.getByText('test-file.ts')).toBeInTheDocument()
  })

  it('should render a symbol node with function kind', () => {
    render(
      <svg>
        <GraphNode {...defaultProps} type="symbol" symbolKind="function" name="myFunction" />
      </svg>
    )

    expect(screen.getByText('fn')).toBeInTheDocument()
    expect(screen.getByText('myFunction')).toBeInTheDocument()
  })

  it('should render a symbol node with class kind', () => {
    render(
      <svg>
        <GraphNode {...defaultProps} type="symbol" symbolKind="class" name="MyClass" />
      </svg>
    )

    expect(screen.getByText('C')).toBeInTheDocument()
  })

  it('should render a symbol node with interface kind', () => {
    render(
      <svg>
        <GraphNode {...defaultProps} type="symbol" symbolKind="interface" name="MyInterface" />
      </svg>
    )

    expect(screen.getByText('I')).toBeInTheDocument()
  })

  it('should truncate long names', () => {
    render(
      <svg>
        <GraphNode {...defaultProps} name="very-long-file-name-that-should-be-truncated.ts" />
      </svg>
    )

    expect(screen.getByText('very-long-...')).toBeInTheDocument()
  })

  it('should call onHover when mouse enters', () => {
    const onHover = vi.fn()
    render(
      <svg>
        <GraphNode {...defaultProps} onHover={onHover} />
      </svg>
    )

    fireEvent.mouseEnter(screen.getByTestId('graph-node-node-1'))
    expect(onHover).toHaveBeenCalled()
  })

  it('should call onHoverEnd when mouse leaves', () => {
    const onHoverEnd = vi.fn()
    render(
      <svg>
        <GraphNode {...defaultProps} onHoverEnd={onHoverEnd} />
      </svg>
    )

    fireEvent.mouseLeave(screen.getByTestId('graph-node-node-1'))
    expect(onHoverEnd).toHaveBeenCalled()
  })

  it('should call onClick when clicked', () => {
    const onClick = vi.fn()
    render(
      <svg>
        <GraphNode {...defaultProps} onClick={onClick} />
      </svg>
    )

    fireEvent.click(screen.getByTestId('graph-node-node-1'))
    expect(onClick).toHaveBeenCalled()
  })

  it('should call onDoubleClick when double-clicked', () => {
    const onDoubleClick = vi.fn()
    render(
      <svg>
        <GraphNode {...defaultProps} onDoubleClick={onDoubleClick} />
      </svg>
    )

    fireEvent.doubleClick(screen.getByTestId('graph-node-node-1'))
    expect(onDoubleClick).toHaveBeenCalled()
  })

  it('should apply selected state styling', () => {
    render(
      <svg>
        <GraphNode {...defaultProps} state="selected" />
      </svg>
    )

    // Selected nodes should have a glow effect (extra circle)
    const node = screen.getByTestId('graph-node-node-1')
    expect(node.querySelectorAll('circle').length).toBeGreaterThan(1)
  })

  it('should apply faded state styling', () => {
    render(
      <svg>
        <GraphNode {...defaultProps} state="faded" />
      </svg>
    )

    const node = screen.getByTestId('graph-node-node-1')
    expect(node.getAttribute('opacity')).toBe('0.3')
  })
})
