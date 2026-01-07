import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { SearchBar } from '@/components/search/SearchBar'
import { useAppStore } from '@/stores/useAppStore'

describe('SearchBar', () => {
  beforeEach(() => {
    // Reset store state with sample nodes
    useAppStore.setState({
      nodes: [
        { id: 'file-1', name: 'App.tsx', type: 'file', language: 'typescript', state: 'default', isExported: true, connectionCount: 3 },
        { id: 'file-2', name: 'utils.ts', type: 'file', language: 'typescript', state: 'default', isExported: true, connectionCount: 2 },
        { id: 'file-3', name: 'types.ts', type: 'file', language: 'typescript', state: 'default', isExported: true, connectionCount: 1, path: 'src/types.ts' },
        { id: 'sym-1', name: 'handleClick', type: 'symbol', symbolKind: 'function', state: 'default', isExported: true, connectionCount: 1 },
      ],
      searchQuery: '',
      isSearchFocused: false,
      selectedNodeId: null,
    })
  })

  it('should render search input with placeholder', () => {
    render(<SearchBar />)
    expect(screen.getByPlaceholderText(/search files/i)).toBeInTheDocument()
  })

  it('should show keyboard shortcut hint', () => {
    render(<SearchBar />)
    expect(screen.getByText('⌘K')).toBeInTheDocument()
  })

  it('should update local query on input change', () => {
    render(<SearchBar />)
    const input = screen.getByPlaceholderText(/search files/i)

    fireEvent.change(input, { target: { value: 'App' } })

    expect(input).toHaveValue('App')
  })

  it('should show clear button when query is not empty', () => {
    render(<SearchBar />)
    const input = screen.getByPlaceholderText(/search files/i)

    // Initially no clear button
    expect(screen.queryByRole('button')).not.toBeInTheDocument()

    fireEvent.change(input, { target: { value: 'test' } })

    // Clear button should appear
    expect(screen.getByRole('button')).toBeInTheDocument()
  })

  it('should clear query when clear button is clicked', () => {
    render(<SearchBar />)
    const input = screen.getByPlaceholderText(/search files/i)

    fireEvent.change(input, { target: { value: 'test' } })
    const clearButton = screen.getByRole('button')
    fireEvent.click(clearButton)

    expect(input).toHaveValue('')
  })

  it('should show dropdown with matching results', async () => {
    render(<SearchBar />)
    const input = screen.getByPlaceholderText(/search files/i)

    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'App' } })

    await waitFor(() => {
      expect(screen.getByText('App.tsx')).toBeInTheDocument()
    })
  })

  it('should show no results message when no matches', async () => {
    render(<SearchBar />)
    const input = screen.getByPlaceholderText(/search files/i)

    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'xyz123notfound' } })

    await waitFor(() => {
      expect(screen.getByText(/no results/i)).toBeInTheDocument()
    })
  })

  it('should highlight matching text in results', async () => {
    render(<SearchBar />)
    const input = screen.getByPlaceholderText(/search files/i)

    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'App' } })

    await waitFor(() => {
      const mark = screen.getByText('App')
      expect(mark.tagName).toBe('MARK')
    })
  })

  it('should select node when result is clicked', async () => {
    const onSelectNode = vi.fn()
    render(<SearchBar onSelectNode={onSelectNode} />)
    const input = screen.getByPlaceholderText(/search files/i)

    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'App' } })

    await waitFor(() => {
      const result = screen.getByText('App.tsx')
      fireEvent.click(result.closest('button')!)
    })

    expect(useAppStore.getState().selectedNodeId).toBe('file-1')
    expect(onSelectNode).toHaveBeenCalledWith('file-1')
  })

  it('should navigate with arrow keys', async () => {
    render(<SearchBar />)
    const input = screen.getByPlaceholderText(/search files/i)

    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'ts' } })

    await waitFor(() => {
      expect(screen.getByText('utils.ts')).toBeInTheDocument()
    })

    // Arrow down to select second item
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    fireEvent.keyDown(input, { key: 'ArrowDown' })

    // Enter to select
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(useAppStore.getState().selectedNodeId).toBeTruthy()
  })

  it('should close dropdown on escape', async () => {
    render(<SearchBar />)
    const input = screen.getByPlaceholderText(/search files/i)

    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'App' } })

    await waitFor(() => {
      expect(screen.getByText('App.tsx')).toBeInTheDocument()
    })

    fireEvent.keyDown(input, { key: 'Escape' })

    await waitFor(() => {
      expect(screen.queryByText('App.tsx')).not.toBeInTheDocument()
    })
  })

  it('should search by path', async () => {
    render(<SearchBar />)
    const input = screen.getByPlaceholderText(/search files/i)

    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'src/types' } })

    await waitFor(() => {
      expect(screen.getByText('types.ts')).toBeInTheDocument()
    })
  })

  it('should show language badge for file results', async () => {
    render(<SearchBar />)
    const input = screen.getByPlaceholderText(/search files/i)

    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'App' } })

    await waitFor(() => {
      expect(screen.getByText('typescript')).toBeInTheDocument()
    })
  })

  it('should debounce search query update to store', async () => {
    vi.useFakeTimers()
    render(<SearchBar />)
    const input = screen.getByPlaceholderText(/search files/i)

    fireEvent.change(input, { target: { value: 'test' } })

    // Store should not be updated immediately
    expect(useAppStore.getState().searchQuery).toBe('')

    // Advance timers to trigger debounce
    vi.advanceTimersByTime(200)

    expect(useAppStore.getState().searchQuery).toBe('test')

    vi.useRealTimers()
  })
})
