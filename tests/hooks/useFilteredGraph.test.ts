import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useFilteredGraph } from '@/hooks/useFilteredGraph'
import { useAppStore } from '@/stores/useAppStore'

describe('useFilteredGraph', () => {
  const sampleNodes = [
    { id: 'file-1', name: 'App.tsx', type: 'file' as const, language: 'typescript' as const, state: 'default' as const, isExported: true, connectionCount: 3 },
    { id: 'file-2', name: 'utils.ts', type: 'file' as const, language: 'typescript' as const, state: 'default' as const, isExported: true, connectionCount: 2 },
    { id: 'file-3', name: 'main.py', type: 'file' as const, language: 'python' as const, state: 'default' as const, isExported: true, connectionCount: 1 },
    { id: 'sym-1', name: 'handleClick', type: 'symbol' as const, symbolKind: 'function' as const, language: 'typescript' as const, state: 'default' as const, isExported: true, connectionCount: 1 },
    { id: 'sym-2', name: 'User', type: 'symbol' as const, symbolKind: 'class' as const, language: 'typescript' as const, state: 'default' as const, isExported: true, connectionCount: 2 },
  ]

  const sampleEdges = [
    { id: 'edge-1', source: 'file-1', target: 'file-2', type: 'imports' as const },
    { id: 'edge-2', source: 'file-2', target: 'file-3', type: 'imports' as const },
    { id: 'edge-3', source: 'sym-1', target: 'sym-2', type: 'calls' as const },
    { id: 'edge-4', source: 'file-1', target: 'sym-1', type: 'contains' as const },
  ]

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
      nodes: sampleNodes,
      edges: sampleEdges,
      filterState: { ...defaultFilterState },
      searchQuery: '',
      viewMode: 'file',
    })
  })

  it('should return file nodes when in file mode (default)', () => {
    const { result } = renderHook(() => useFilteredGraph())

    // In file mode, only file nodes are shown by default
    expect(result.current.nodes).toHaveLength(3) // 3 file nodes
    expect(result.current.edges).toHaveLength(2) // Only edges between visible file nodes
  })

  it('should filter nodes by language', () => {
    useAppStore.setState({
      filterState: { ...defaultFilterState, languages: ['typescript'] },
    })

    const { result } = renderHook(() => useFilteredGraph())

    expect(result.current.nodes.filter(n => n.type === 'file')).toHaveLength(2)
    expect(result.current.nodes.every(n => n.type === 'symbol' || n.language === 'typescript')).toBe(true)
  })

  it('should filter edges when nodes are filtered', () => {
    useAppStore.setState({
      filterState: { ...defaultFilterState, languages: ['typescript'] },
    })

    const { result } = renderHook(() => useFilteredGraph())

    // Edge to python file should be removed
    const edgeIds = result.current.edges.map(e => e.id)
    expect(edgeIds).not.toContain('edge-2')
  })

  it('should filter by symbol kind in symbol mode', () => {
    useAppStore.setState({
      viewMode: 'symbol',
      filterState: { ...defaultFilterState, viewMode: 'symbol', symbolKinds: ['function'] },
    })

    const { result } = renderHook(() => useFilteredGraph())

    const symbols = result.current.nodes.filter(n => n.type === 'symbol')
    expect(symbols).toHaveLength(1)
    expect(symbols[0].name).toBe('handleClick')
  })

  it('should filter by relationship type', () => {
    useAppStore.setState({
      filterState: {
        ...defaultFilterState,
        relationshipTypes: ['imports'],
      },
    })

    const { result } = renderHook(() => useFilteredGraph())

    expect(result.current.edges.every(e => e.type === 'imports')).toBe(true)
    expect(result.current.edges).toHaveLength(2)
  })

  it('should identify search matches', () => {
    useAppStore.setState({
      searchQuery: 'App',
    })

    const { result } = renderHook(() => useFilteredGraph())

    expect(result.current.searchMatchIds.has('file-1')).toBe(true)
    expect(result.current.searchMatchIds.has('file-2')).toBe(false)
    expect(result.current.hasSearchQuery).toBe(true)
  })

  it('should match nodes by path', () => {
    useAppStore.setState({
      nodes: [
        ...sampleNodes.slice(0, 2).map((n, i) => ({ ...n, path: i === 0 ? 'src/components/App.tsx' : 'src/utils/utils.ts' })),
        ...sampleNodes.slice(2),
      ],
      searchQuery: 'components',
    })

    const { result } = renderHook(() => useFilteredGraph())

    expect(result.current.searchMatchIds.has('file-1')).toBe(true)
  })

  it('should calculate stats correctly', () => {
    useAppStore.setState({
      filterState: { ...defaultFilterState, languages: ['typescript'] },
    })

    const { result } = renderHook(() => useFilteredGraph())

    expect(result.current.stats.totalNodes).toBe(5)
    expect(result.current.stats.visibleNodes).toBeLessThan(5)
    expect(result.current.stats.hasActiveFilters).toBe(true)
  })

  it('should not count filters as active when defaults are used', () => {
    const { result } = renderHook(() => useFilteredGraph())

    expect(result.current.stats.hasActiveFilters).toBe(false)
  })

  it('should count search query as active filter', () => {
    useAppStore.setState({
      searchQuery: 'test',
    })

    const { result } = renderHook(() => useFilteredGraph())

    expect(result.current.stats.hasActiveFilters).toBe(true)
  })

  it('should return search match count in stats', () => {
    useAppStore.setState({
      searchQuery: 'ts',
    })

    const { result } = renderHook(() => useFilteredGraph())

    expect(result.current.stats.searchMatches).toBe(2) // App.tsx and utils.ts
  })

  it('should handle empty search query', () => {
    useAppStore.setState({
      searchQuery: '   ',
    })

    const { result } = renderHook(() => useFilteredGraph())

    expect(result.current.searchMatchIds.size).toBe(0)
    expect(result.current.hasSearchQuery).toBe(false)
  })

  it('should filter by view mode in file mode', () => {
    useAppStore.setState({
      viewMode: 'file',
      filterState: { ...defaultFilterState, viewMode: 'file' },
    })

    const { result } = renderHook(() => useFilteredGraph())

    // In file mode, only file nodes should be shown
    const fileNodes = result.current.nodes.filter(n => n.type === 'file')
    expect(fileNodes.length).toBe(3)
  })

  it('should show all nodes in symbol mode', () => {
    useAppStore.setState({
      viewMode: 'symbol',
      filterState: { ...defaultFilterState, viewMode: 'symbol' },
    })

    const { result } = renderHook(() => useFilteredGraph())

    expect(result.current.nodes).toHaveLength(5)
  })

  it('should combine multiple filters in symbol mode', () => {
    useAppStore.setState({
      viewMode: 'symbol',
      filterState: {
        ...defaultFilterState,
        viewMode: 'symbol',
        languages: ['typescript'],
        symbolKinds: ['function'],
      },
    })

    const { result } = renderHook(() => useFilteredGraph())

    // In symbol mode with TS language and function kind filter:
    // - Should have 2 TS files
    // - Should have 1 function symbol (the only one matching 'function' kind)
    expect(result.current.nodes.filter(n => n.type === 'file').length).toBe(2)
    expect(result.current.nodes.filter(n => n.type === 'symbol').length).toBe(1)
  })
})
