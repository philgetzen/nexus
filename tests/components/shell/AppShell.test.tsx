import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AppShell } from '@/components/shell/AppShell'
import { useAppStore } from '@/stores/useAppStore'

describe('AppShell', () => {
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
      currentProject: null,
      recentProjects: [],
    })
  })

  it('should render the shell with toolbar, sidebar, and inspector', () => {
    render(<AppShell />)

    // Toolbar elements
    expect(screen.getByText('Nexus')).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/search files/i)).toBeInTheDocument()

    // Inspector header
    expect(screen.getByText('Inspector')).toBeInTheDocument()

    // Welcome message in main area
    expect(screen.getByText('Welcome to Nexus')).toBeInTheDocument()
  })

  it('should render children in the main content area', () => {
    render(
      <AppShell>
        <div data-testid="test-content">Test Content</div>
      </AppShell>
    )

    expect(screen.getByTestId('test-content')).toBeInTheDocument()
  })

  it('should hide sidebar when sidebarOpen is false', () => {
    useAppStore.setState({
      panels: {
        sidebarOpen: false,
        inspectorOpen: true,
        analysisPanelOpen: false,
        analysisPanelHeight: 200,
      },
    })

    render(<AppShell />)

    // Files heading should not be visible when sidebar is closed
    expect(screen.queryByText('Files')).not.toBeInTheDocument()
  })

  it('should hide inspector when inspectorOpen is false', () => {
    useAppStore.setState({
      panels: {
        sidebarOpen: true,
        inspectorOpen: false,
        analysisPanelOpen: false,
        analysisPanelHeight: 200,
      },
    })

    render(<AppShell />)

    // Inspector header should not be visible
    expect(screen.queryByText('Inspector')).not.toBeInTheDocument()
  })

  it('should show both panels by default', () => {
    render(<AppShell />)

    // Both sidebar and inspector elements should be present
    expect(screen.getByText('Files')).toBeInTheDocument()
    expect(screen.getByText('Inspector')).toBeInTheDocument()
  })
})
