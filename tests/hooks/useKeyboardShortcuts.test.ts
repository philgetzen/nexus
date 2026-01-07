import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import { useAppStore } from '@/stores/useAppStore'

describe('useKeyboardShortcuts', () => {
  beforeEach(() => {
    // Reset store state
    useAppStore.setState({
      panels: {
        sidebarOpen: true,
        inspectorOpen: true,
        analysisPanelOpen: false,
        analysisPanelHeight: 200,
      },
      isSearchFocused: false,
      selectedNodeId: null,
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
    vi.restoreAllMocks()
  })

  const createKeyEvent = (key: string, options: Partial<KeyboardEventInit> = {}) => {
    return new KeyboardEvent('keydown', {
      key,
      bubbles: true,
      cancelable: true,
      ...options,
    })
  }

  it('should toggle sidebar with Cmd+1', async () => {
    // Spy on toggleSidebar
    const toggleSidebarSpy = vi.fn()
    const originalToggleSidebar = useAppStore.getState().toggleSidebar
    useAppStore.setState({ toggleSidebar: toggleSidebarSpy })

    // Mock Mac platform
    vi.spyOn(navigator, 'platform', 'get').mockReturnValue('MacIntel')

    renderHook(() => useKeyboardShortcuts())

    await act(async () => {
      window.dispatchEvent(createKeyEvent('1', { metaKey: true }))
    })

    expect(toggleSidebarSpy).toHaveBeenCalled()

    // Restore
    useAppStore.setState({ toggleSidebar: originalToggleSidebar })
  })

  it('should toggle inspector with Cmd+2', async () => {
    const toggleInspectorSpy = vi.fn()
    const originalToggleInspector = useAppStore.getState().toggleInspector
    useAppStore.setState({ toggleInspector: toggleInspectorSpy })

    vi.spyOn(navigator, 'platform', 'get').mockReturnValue('MacIntel')

    renderHook(() => useKeyboardShortcuts())

    await act(async () => {
      window.dispatchEvent(createKeyEvent('2', { metaKey: true }))
    })

    expect(toggleInspectorSpy).toHaveBeenCalled()

    useAppStore.setState({ toggleInspector: originalToggleInspector })
  })

  it('should focus search with Cmd+K', async () => {
    const setSearchFocusedSpy = vi.fn()
    const originalSetSearchFocused = useAppStore.getState().setSearchFocused
    useAppStore.setState({ setSearchFocused: setSearchFocusedSpy })

    vi.spyOn(navigator, 'platform', 'get').mockReturnValue('MacIntel')

    renderHook(() => useKeyboardShortcuts())

    await act(async () => {
      window.dispatchEvent(createKeyEvent('k', { metaKey: true }))
    })

    expect(setSearchFocusedSpy).toHaveBeenCalledWith(true)

    useAppStore.setState({ setSearchFocused: originalSetSearchFocused })
  })

  it('should clear selection with Escape', async () => {
    const selectNodeSpy = vi.fn()
    const setSearchFocusedSpy = vi.fn()
    const originalSelectNode = useAppStore.getState().selectNode
    const originalSetSearchFocused = useAppStore.getState().setSearchFocused

    useAppStore.setState({
      selectNode: selectNodeSpy,
      setSearchFocused: setSearchFocusedSpy,
      selectedNodeId: 'node-1',
      isSearchFocused: true,
    })

    renderHook(() => useKeyboardShortcuts())

    await act(async () => {
      window.dispatchEvent(createKeyEvent('Escape'))
    })

    expect(selectNodeSpy).toHaveBeenCalledWith(null)
    expect(setSearchFocusedSpy).toHaveBeenCalledWith(false)

    useAppStore.setState({
      selectNode: originalSelectNode,
      setSearchFocused: originalSetSearchFocused,
    })
  })

  it('should use Ctrl key on Windows platforms', async () => {
    const toggleSidebarSpy = vi.fn()
    const originalToggleSidebar = useAppStore.getState().toggleSidebar
    useAppStore.setState({ toggleSidebar: toggleSidebarSpy })

    vi.spyOn(navigator, 'platform', 'get').mockReturnValue('Win32')

    renderHook(() => useKeyboardShortcuts())

    await act(async () => {
      window.dispatchEvent(createKeyEvent('1', { ctrlKey: true }))
    })

    expect(toggleSidebarSpy).toHaveBeenCalled()

    useAppStore.setState({ toggleSidebar: originalToggleSidebar })
  })

  it('should cleanup event listener on unmount', () => {
    const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener')

    const { unmount } = renderHook(() => useKeyboardShortcuts())

    unmount()

    expect(removeEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function))
  })

  it('should not toggle with wrong modifier key', async () => {
    const toggleSidebarSpy = vi.fn()
    const originalToggleSidebar = useAppStore.getState().toggleSidebar
    useAppStore.setState({ toggleSidebar: toggleSidebarSpy })

    vi.spyOn(navigator, 'platform', 'get').mockReturnValue('MacIntel')

    renderHook(() => useKeyboardShortcuts())

    // Should not trigger with ctrlKey on Mac
    await act(async () => {
      window.dispatchEvent(createKeyEvent('1', { ctrlKey: true }))
    })

    expect(toggleSidebarSpy).not.toHaveBeenCalled()

    useAppStore.setState({ toggleSidebar: originalToggleSidebar })
  })
})
