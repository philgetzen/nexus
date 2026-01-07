import { useMemo } from 'react'
import { useAppStore } from '@/stores/useAppStore'

/**
 * Hook that filters graph nodes and edges based on the current filter state and search query.
 * Returns the filtered nodes/edges and search match information.
 */
export function useFilteredGraph() {
  const {
    nodes,
    edges,
    filterState,
    searchQuery,
    viewMode,
  } = useAppStore()

  // Get set of node IDs that match the search query
  const searchMatchIds = useMemo(() => {
    if (!searchQuery.trim()) return new Set<string>()

    const query = searchQuery.toLowerCase()
    const matches = new Set<string>()

    for (const node of nodes) {
      // Match by name
      if (node.name.toLowerCase().includes(query)) {
        matches.add(node.id)
        continue
      }
      // Match by path
      if (node.path?.toLowerCase().includes(query)) {
        matches.add(node.id)
      }
    }

    return matches
  }, [nodes, searchQuery])

  // Filter nodes based on filter state
  const filteredNodes = useMemo(() => {
    return nodes.filter((node) => {
      // View mode filter: file vs symbol level
      if (viewMode === 'file' && node.type !== 'file') {
        return false
      }
      if (viewMode === 'symbol' && node.type === 'file') {
        // In symbol mode, still show files but could be more nuanced
        // For now, show everything in symbol mode
      }

      // Language filter
      if (filterState.languages.length > 0) {
        if (!node.language || !filterState.languages.includes(node.language)) {
          return false
        }
      }

      // Symbol kind filter (only applies to symbol nodes)
      if (filterState.symbolKinds.length > 0 && node.type === 'symbol') {
        if (!node.symbolKind || !filterState.symbolKinds.includes(node.symbolKind)) {
          return false
        }
      }

      // Node type filter
      if (filterState.nodeTypes.length > 0) {
        if (!filterState.nodeTypes.includes(node.type)) {
          return false
        }
      }

      return true
    })
  }, [nodes, filterState, viewMode])

  // Get set of filtered node IDs for edge filtering
  const filteredNodeIds = useMemo(
    () => new Set(filteredNodes.map((n) => n.id)),
    [filteredNodes]
  )

  // Filter edges based on filtered nodes and relationship type filters
  const filteredEdges = useMemo(() => {
    return edges.filter((edge) => {
      // Only include edges where both source and target are visible
      if (!filteredNodeIds.has(edge.source) || !filteredNodeIds.has(edge.target)) {
        return false
      }

      // Relationship type filter
      if (filterState.relationshipTypes.length > 0) {
        if (!filterState.relationshipTypes.includes(edge.type)) {
          return false
        }
      }

      return true
    })
  }, [edges, filteredNodeIds, filterState.relationshipTypes])

  // Enhance nodes with search match state
  const enhancedNodes = useMemo(() => {
    if (!searchQuery.trim()) return filteredNodes

    return filteredNodes.map((node) => ({
      ...node,
      isSearchMatch: searchMatchIds.has(node.id),
    }))
  }, [filteredNodes, searchMatchIds, searchQuery])

  // Stats for display
  const stats = useMemo(
    () => ({
      totalNodes: nodes.length,
      visibleNodes: filteredNodes.length,
      totalEdges: edges.length,
      visibleEdges: filteredEdges.length,
      searchMatches: searchMatchIds.size,
      hasActiveFilters:
        filterState.languages.length > 0 ||
        filterState.symbolKinds.length > 0 ||
        filterState.relationshipTypes.length < 7 ||
        !!searchQuery.trim(),
    }),
    [nodes.length, filteredNodes.length, edges.length, filteredEdges.length, searchMatchIds.size, filterState, searchQuery]
  )

  return {
    nodes: enhancedNodes,
    edges: filteredEdges,
    searchMatchIds,
    stats,
    hasSearchQuery: searchQuery.trim().length > 0,
  }
}
