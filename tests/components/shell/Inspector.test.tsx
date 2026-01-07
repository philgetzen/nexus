import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Inspector } from '@/components/shell/Inspector'
import { useAppStore } from '@/stores/useAppStore'

describe('Inspector', () => {
  beforeEach(() => {
    useAppStore.setState({
      panels: {
        sidebarOpen: true,
        inspectorOpen: true,
        analysisPanelOpen: false,
        analysisPanelHeight: 200,
      },
    })
  })

  it('should render empty state when no node is selected', () => {
    render(<Inspector />)

    expect(screen.getByText('Select a node to see details')).toBeInTheDocument()
    expect(screen.getByText(/click on any file/i)).toBeInTheDocument()
  })

  it('should render node details when a node is selected', () => {
    const selectedNode = {
      id: 'node-1',
      name: 'MyComponent.tsx',
      type: 'file' as const,
      path: 'src/components/MyComponent.tsx',
      incoming: [{ name: 'App.tsx', type: 'imports' }],
      outgoing: [{ name: 'utils.ts', type: 'imports' }],
    }

    render(<Inspector selectedNode={selectedNode} />)

    expect(screen.getByText('MyComponent.tsx')).toBeInTheDocument()
    expect(screen.getByText('file')).toBeInTheDocument()
    expect(screen.getByText('src/components/MyComponent.tsx')).toBeInTheDocument()
  })

  it('should show incoming relationships', () => {
    const selectedNode = {
      id: 'node-1',
      name: 'MyComponent.tsx',
      type: 'file' as const,
      path: 'src/components/MyComponent.tsx',
      incoming: [
        { name: 'App.tsx', type: 'imports' },
        { name: 'Page.tsx', type: 'imports' },
      ],
      outgoing: [],
    }

    render(<Inspector selectedNode={selectedNode} />)

    expect(screen.getByText('Incoming (2)')).toBeInTheDocument()
    expect(screen.getByText('App.tsx')).toBeInTheDocument()
    expect(screen.getByText('Page.tsx')).toBeInTheDocument()
  })

  it('should show outgoing relationships', () => {
    const selectedNode = {
      id: 'node-1',
      name: 'MyComponent.tsx',
      type: 'file' as const,
      path: 'src/components/MyComponent.tsx',
      incoming: [],
      outgoing: [
        { name: 'utils.ts', type: 'imports' },
        { name: 'types.ts', type: 'imports' },
      ],
    }

    render(<Inspector selectedNode={selectedNode} />)

    expect(screen.getByText('Outgoing (2)')).toBeInTheDocument()
    expect(screen.getByText('utils.ts')).toBeInTheDocument()
    expect(screen.getByText('types.ts')).toBeInTheDocument()
  })

  it('should show code snippet when provided', () => {
    const selectedNode = {
      id: 'node-1',
      name: 'myFunction',
      type: 'symbol' as const,
      symbolKind: 'function' as const,
      path: 'src/utils.ts',
      lineNumber: 42,
      incoming: [],
      outgoing: [],
      codeSnippet: 'function myFunction() { return 42; }',
    }

    render(<Inspector selectedNode={selectedNode} />)

    expect(screen.getByText('Preview')).toBeInTheDocument()
    expect(screen.getByText(/function myFunction/)).toBeInTheDocument()
  })

  it('should show line number in location', () => {
    const selectedNode = {
      id: 'node-1',
      name: 'myFunction',
      type: 'symbol' as const,
      symbolKind: 'function' as const,
      path: 'src/utils.ts',
      lineNumber: 42,
      incoming: [],
      outgoing: [],
    }

    render(<Inspector selectedNode={selectedNode} />)

    expect(screen.getByText('src/utils.ts:42')).toBeInTheDocument()
  })

  it('should close when close button is clicked', () => {
    render(<Inspector />)

    const closeButton = screen.getByLabelText('Close inspector')
    fireEvent.click(closeButton)

    expect(useAppStore.getState().panels.inspectorOpen).toBe(false)
  })

  it('should not render when inspector is closed', () => {
    useAppStore.setState({
      panels: {
        sidebarOpen: true,
        inspectorOpen: false,
        analysisPanelOpen: false,
        analysisPanelHeight: 200,
      },
    })

    const { container } = render(<Inspector />)

    expect(container.querySelector('aside')).not.toBeInTheDocument()
  })

  it('should display symbol kind for symbol nodes', () => {
    const selectedNode = {
      id: 'node-1',
      name: 'MyClass',
      type: 'symbol' as const,
      symbolKind: 'class' as const,
      path: 'src/models/MyClass.ts',
      incoming: [],
      outgoing: [],
    }

    render(<Inspector selectedNode={selectedNode} />)

    expect(screen.getByText('class')).toBeInTheDocument()
  })
})
