import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Toolbar } from '@/components/shell/Toolbar'
import { useAppStore } from '@/stores/useAppStore'

describe('Toolbar', () => {
  beforeEach(() => {
    // Reset store state
    useAppStore.setState({
      panels: {
        sidebarOpen: true,
        inspectorOpen: true,
        analysisPanelOpen: false,
        analysisPanelHeight: 200,
      },
      searchQuery: '',
      isSearchFocused: false,
      zoomLevel: 100,
    })
  })

  it('should render the toolbar with logo', () => {
    render(<Toolbar />)
    expect(screen.getByText('Nexus')).toBeInTheDocument()
  })

  it('should render search input', () => {
    render(<Toolbar />)
    expect(screen.getByPlaceholderText(/search files/i)).toBeInTheDocument()
  })

  it('should show keyboard shortcut hint for search', () => {
    render(<Toolbar />)
    expect(screen.getByText('⌘K')).toBeInTheDocument()
  })

  it('should toggle sidebar when sidebar button is clicked', () => {
    render(<Toolbar />)

    const sidebarButton = screen.getByLabelText('Toggle sidebar')
    expect(useAppStore.getState().panels.sidebarOpen).toBe(true)

    fireEvent.click(sidebarButton)

    expect(useAppStore.getState().panels.sidebarOpen).toBe(false)
  })

  it('should toggle inspector when inspector button is clicked', () => {
    render(<Toolbar />)

    const inspectorButton = screen.getByLabelText('Toggle inspector')
    expect(useAppStore.getState().panels.inspectorOpen).toBe(true)

    fireEvent.click(inspectorButton)

    expect(useAppStore.getState().panels.inspectorOpen).toBe(false)
  })

  it('should update search query when typing', () => {
    render(<Toolbar />)

    const searchInput = screen.getByPlaceholderText(/search files/i)
    fireEvent.change(searchInput, { target: { value: 'test query' } })

    expect(useAppStore.getState().searchQuery).toBe('test query')
  })

  it('should display current zoom level', () => {
    render(<Toolbar />)
    expect(screen.getByText('100%')).toBeInTheDocument()
  })

  it('should increase zoom when zoom in is clicked', () => {
    render(<Toolbar />)

    const zoomInButton = screen.getByLabelText('Zoom in')
    fireEvent.click(zoomInButton)

    expect(useAppStore.getState().zoomLevel).toBe(125)
  })

  it('should decrease zoom when zoom out is clicked', () => {
    render(<Toolbar />)

    const zoomOutButton = screen.getByLabelText('Zoom out')
    fireEvent.click(zoomOutButton)

    expect(useAppStore.getState().zoomLevel).toBe(75)
  })

  it('should reset zoom when fit to view is clicked', () => {
    useAppStore.setState({ zoomLevel: 200 })

    render(<Toolbar />)

    const fitButton = screen.getByLabelText('Fit to view')
    fireEvent.click(fitButton)

    expect(useAppStore.getState().zoomLevel).toBe(100)
  })

  it('should highlight sidebar button when sidebar is open', () => {
    render(<Toolbar />)

    const sidebarButton = screen.getByLabelText('Toggle sidebar')
    expect(sidebarButton.className).toContain('bg-violet')
  })

  it('should call onToggleFilter when filter button is clicked', () => {
    const onToggleFilter = vi.fn()
    render(<Toolbar onToggleFilter={onToggleFilter} />)

    const filterButton = screen.getByLabelText('Filter')
    fireEvent.click(filterButton)

    expect(onToggleFilter).toHaveBeenCalled()
  })

  it('should call onOpenSettings when settings button is clicked', () => {
    const onOpenSettings = vi.fn()
    render(<Toolbar onOpenSettings={onOpenSettings} />)

    const settingsButton = screen.getByLabelText('Settings')
    fireEvent.click(settingsButton)

    expect(onOpenSettings).toHaveBeenCalled()
  })
})
