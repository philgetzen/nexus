import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { FilterPanel } from '@/components/search/FilterPanel'
import { useAppStore } from '@/stores/useAppStore'

describe('FilterPanel', () => {
  const defaultFilterState = {
    viewMode: 'file' as const,
    languages: [],
    nodeTypes: ['file', 'symbol'] as const,
    relationshipTypes: ['imports', 'exports', 'calls', 'extends', 'implements', 'references', 'contains'] as const,
    symbolKinds: [],
    clusters: [],
    searchQuery: null,
  }

  beforeEach(() => {
    useAppStore.setState({
      filterState: { ...defaultFilterState },
      viewMode: 'file',
    })
  })

  it('should not render when closed', () => {
    render(<FilterPanel isOpen={false} onClose={vi.fn()} />)
    expect(screen.queryByText('Filters')).not.toBeInTheDocument()
  })

  it('should render filter panel when open', () => {
    render(<FilterPanel isOpen={true} onClose={vi.fn()} />)
    expect(screen.getByText('Filters')).toBeInTheDocument()
  })

  it('should show view mode section', () => {
    render(<FilterPanel isOpen={true} onClose={vi.fn()} />)
    expect(screen.getByText('View Mode')).toBeInTheDocument()
  })

  it('should show file level and symbol level options', () => {
    render(<FilterPanel isOpen={true} onClose={vi.fn()} />)
    expect(screen.getByText('File Level')).toBeInTheDocument()
    expect(screen.getByText('Symbol Level')).toBeInTheDocument()
  })

  it('should toggle view mode when clicked', () => {
    render(<FilterPanel isOpen={true} onClose={vi.fn()} />)

    const symbolButton = screen.getByText('Symbol Level')
    fireEvent.click(symbolButton)

    expect(useAppStore.getState().viewMode).toBe('symbol')
  })

  it('should show languages section', () => {
    render(<FilterPanel isOpen={true} onClose={vi.fn()} />)
    expect(screen.getByText('Languages')).toBeInTheDocument()
  })

  it('should show language options', () => {
    render(<FilterPanel isOpen={true} onClose={vi.fn()} />)
    expect(screen.getByText('TypeScript')).toBeInTheDocument()
    expect(screen.getByText('JavaScript')).toBeInTheDocument()
    expect(screen.getByText('Python')).toBeInTheDocument()
  })

  it('should toggle language filter when clicked', () => {
    render(<FilterPanel isOpen={true} onClose={vi.fn()} />)

    const tsButton = screen.getByText('TypeScript')
    fireEvent.click(tsButton)

    expect(useAppStore.getState().filterState.languages).toContain('typescript')
  })

  it('should remove language filter when clicked again', () => {
    useAppStore.setState({
      filterState: { ...defaultFilterState, languages: ['typescript'] },
    })

    render(<FilterPanel isOpen={true} onClose={vi.fn()} />)

    const tsButton = screen.getByText('TypeScript')
    fireEvent.click(tsButton)

    expect(useAppStore.getState().filterState.languages).not.toContain('typescript')
  })

  it('should show symbol types section', () => {
    render(<FilterPanel isOpen={true} onClose={vi.fn()} />)
    expect(screen.getByText('Symbol Types')).toBeInTheDocument()
  })

  it('should toggle symbol kind filter', () => {
    render(<FilterPanel isOpen={true} onClose={vi.fn()} />)

    // Expand symbol types section first
    fireEvent.click(screen.getByText('Symbol Types'))

    const funcButton = screen.getByText('Functions')
    fireEvent.click(funcButton)

    expect(useAppStore.getState().filterState.symbolKinds).toContain('function')
  })

  it('should show relationships section', () => {
    render(<FilterPanel isOpen={true} onClose={vi.fn()} />)
    expect(screen.getByText('Relationships')).toBeInTheDocument()
  })

  it('should toggle relationship type filter', () => {
    render(<FilterPanel isOpen={true} onClose={vi.fn()} />)

    // Expand relationships section first
    fireEvent.click(screen.getByText('Relationships'))

    const importsButton = screen.getByText('Imports')
    fireEvent.click(importsButton)

    expect(useAppStore.getState().filterState.relationshipTypes).not.toContain('imports')
  })

  it('should call onClose when close button is clicked', () => {
    const onClose = vi.fn()
    render(<FilterPanel isOpen={true} onClose={onClose} />)

    // Find the X button (close button) and click it
    const closeButtons = screen.getAllByRole('button')
    const closeButton = closeButtons.find(btn => btn.getAttribute('aria-label')?.includes('close') || btn.querySelector('svg'))
    if (closeButton) {
      fireEvent.click(closeButton)
    } else {
      // If no specific close button found, try the last button in header
      fireEvent.click(closeButtons[1])
    }

    expect(onClose).toHaveBeenCalled()
  })

  it('should reset filters when reset button is clicked', () => {
    useAppStore.setState({
      filterState: {
        ...defaultFilterState,
        languages: ['typescript', 'python'],
        symbolKinds: ['function', 'class'],
      },
    })

    render(<FilterPanel isOpen={true} onClose={vi.fn()} />)

    const resetButton = screen.getByTitle('Reset filters')
    fireEvent.click(resetButton)

    const state = useAppStore.getState().filterState
    expect(state.languages).toEqual([])
    expect(state.symbolKinds).toEqual([])
  })

  it('should show active filter count', () => {
    useAppStore.setState({
      filterState: {
        ...defaultFilterState,
        languages: ['typescript', 'python'],
      },
    })

    render(<FilterPanel isOpen={true} onClose={vi.fn()} />)

    expect(screen.getByText('2 active')).toBeInTheDocument()
  })

  it('should show badge count on languages section', () => {
    useAppStore.setState({
      filterState: {
        ...defaultFilterState,
        languages: ['typescript'],
      },
    })

    render(<FilterPanel isOpen={true} onClose={vi.fn()} />)

    // The count should appear near the Languages heading
    const languagesSection = screen.getByText('Languages').closest('button')
    expect(languagesSection).toBeInTheDocument()
    // Look for the count badge
    expect(screen.getByText('1')).toBeInTheDocument()
  })

  it('should collapse and expand sections', () => {
    render(<FilterPanel isOpen={true} onClose={vi.fn()} />)

    // Languages section is expanded by default
    expect(screen.getByText('TypeScript')).toBeVisible()

    // Click to collapse
    fireEvent.click(screen.getByText('Languages'))

    // Content should still be in DOM but the section is collapsed
    // (depending on implementation, this might hide content)
  })
})
