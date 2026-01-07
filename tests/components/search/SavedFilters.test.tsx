import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { SavedFilters } from '@/components/search/SavedFilters'
import { useAppStore } from '@/stores/useAppStore'

describe('SavedFilters', () => {
  const defaultFilterState = {
    viewMode: 'file' as const,
    languages: [],
    nodeTypes: ['file', 'symbol'] as const,
    relationshipTypes: ['imports', 'exports', 'calls', 'extends', 'implements', 'references', 'contains'] as const,
    symbolKinds: [],
    clusters: [],
    searchQuery: null,
  }

  const sampleSavedFilters = [
    {
      id: 'filter-1',
      name: 'TypeScript Only',
      filter: { ...defaultFilterState, languages: ['typescript' as const] },
    },
    {
      id: 'filter-2',
      name: 'Functions & Classes',
      filter: { ...defaultFilterState, symbolKinds: ['function' as const, 'class' as const] },
    },
  ]

  beforeEach(() => {
    useAppStore.setState({
      filterState: { ...defaultFilterState },
      savedFilters: [],
    })
  })

  it('should render saved filters button', () => {
    render(<SavedFilters />)
    expect(screen.getByTitle('Saved filters')).toBeInTheDocument()
  })

  it('should show dropdown when clicked', () => {
    render(<SavedFilters />)

    const button = screen.getByTitle('Saved filters')
    fireEvent.click(button)

    expect(screen.getByText('Saved Filters')).toBeInTheDocument()
  })

  it('should show empty state when no saved filters', () => {
    render(<SavedFilters />)

    const button = screen.getByTitle('Saved filters')
    fireEvent.click(button)

    expect(screen.getByText('No saved filters')).toBeInTheDocument()
  })

  it('should show saved filters list', () => {
    useAppStore.setState({ savedFilters: sampleSavedFilters })

    render(<SavedFilters />)

    const button = screen.getByTitle('Saved filters')
    fireEvent.click(button)

    expect(screen.getByText('TypeScript Only')).toBeInTheDocument()
    expect(screen.getByText('Functions & Classes')).toBeInTheDocument()
  })

  it('should apply saved filter when clicked', () => {
    useAppStore.setState({ savedFilters: sampleSavedFilters })

    render(<SavedFilters />)

    const button = screen.getByTitle('Saved filters')
    fireEvent.click(button)

    const filterItem = screen.getByText('TypeScript Only')
    fireEvent.click(filterItem)

    expect(useAppStore.getState().filterState.languages).toContain('typescript')
  })

  it('should delete saved filter when delete button is clicked', () => {
    useAppStore.setState({ savedFilters: sampleSavedFilters })

    render(<SavedFilters />)

    const button = screen.getByTitle('Saved filters')
    fireEvent.click(button)

    // Find delete buttons
    const deleteButtons = screen.getAllByRole('button').filter(
      btn => btn.className.includes('text-red') || btn.querySelector('[class*="red"]')
    )

    if (deleteButtons.length > 0) {
      fireEvent.click(deleteButtons[0])
    }

    expect(useAppStore.getState().savedFilters).toHaveLength(1)
  })

  it('should show save filter input when save button is clicked', () => {
    render(<SavedFilters />)

    const button = screen.getByTitle('Saved filters')
    fireEvent.click(button)

    const saveButton = screen.getByText('Save Current')
    fireEvent.click(saveButton)

    expect(screen.getByPlaceholderText('Filter name')).toBeInTheDocument()
  })

  it('should save new filter with name', async () => {
    useAppStore.setState({
      filterState: { ...defaultFilterState, languages: ['python' as const] },
    })

    render(<SavedFilters />)

    const button = screen.getByTitle('Saved filters')
    fireEvent.click(button)

    const saveButton = screen.getByText('Save Current')
    fireEvent.click(saveButton)

    const input = screen.getByPlaceholderText('Filter name')
    fireEvent.change(input, { target: { value: 'Python Files' } })

    // Submit the form (press Enter or click save)
    fireEvent.keyDown(input, { key: 'Enter' })

    await waitFor(() => {
      expect(useAppStore.getState().savedFilters.length).toBeGreaterThan(0)
    })
  })

  it('should cancel save when cancel button is clicked', () => {
    render(<SavedFilters />)

    const button = screen.getByTitle('Saved filters')
    fireEvent.click(button)

    const saveButton = screen.getByText('Save Current')
    fireEvent.click(saveButton)

    expect(screen.getByPlaceholderText('Filter name')).toBeInTheDocument()

    // Find cancel button
    const cancelButton = screen.getByRole('button', { name: /cancel/i }) || screen.getAllByRole('button').find(btn => btn.textContent === 'Cancel')
    if (cancelButton) {
      fireEvent.click(cancelButton)
    }

    // The input should no longer be visible
    expect(screen.queryByPlaceholderText('Filter name')).not.toBeInTheDocument()
  })

  it('should call onApply callback when filter is applied', () => {
    const onApply = vi.fn()
    useAppStore.setState({ savedFilters: sampleSavedFilters })

    render(<SavedFilters onApply={onApply} />)

    const button = screen.getByTitle('Saved filters')
    fireEvent.click(button)

    const filterItem = screen.getByText('TypeScript Only')
    fireEvent.click(filterItem)

    expect(onApply).toHaveBeenCalled()
  })

  it('should close dropdown after applying filter', async () => {
    useAppStore.setState({ savedFilters: sampleSavedFilters })

    render(<SavedFilters />)

    const button = screen.getByTitle('Saved filters')
    fireEvent.click(button)

    const filterItem = screen.getByText('TypeScript Only')
    fireEvent.click(filterItem)

    await waitFor(() => {
      expect(screen.queryByText('Saved Filters')).not.toBeInTheDocument()
    })
  })

  it('should not save filter with empty name', () => {
    render(<SavedFilters />)

    const button = screen.getByTitle('Saved filters')
    fireEvent.click(button)

    const saveButton = screen.getByText('Save Current')
    fireEvent.click(saveButton)

    const input = screen.getByPlaceholderText('Filter name')
    fireEvent.change(input, { target: { value: '' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(useAppStore.getState().savedFilters).toHaveLength(0)
  })
})
