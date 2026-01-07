use serde::{Deserialize, Serialize};
use tauri::State;

use crate::error::NexusResult;
use crate::graph::{FilterState, GraphData};
use crate::storage::{FileRecord, RelationshipRecord, SymbolRecord};
use crate::AppState;

/// Get graph data for a project
#[tauri::command]
#[tracing::instrument(skip(state))]
pub async fn get_graph_data(
    project_id: String,
    filters: Option<FilterState>,
    state: State<'_, AppState>,
) -> NexusResult<GraphData> {
    let filters = filters.unwrap_or_default();

    tracing::debug!("Getting graph data for project: {}", project_id);

    // Get files
    let mut files = state.repository.get_files_for_project(&project_id)?;

    // Apply language filter
    if !filters.languages.is_empty() {
        files.retain(|f| filters.languages.contains(&f.language));
    }

    // Apply search filter
    if let Some(query) = &filters.search_query {
        let query_lower = query.to_lowercase();
        files.retain(|f| f.name.to_lowercase().contains(&query_lower));
    }

    // Get symbols for each file
    let mut all_symbols = Vec::new();
    for file in &files {
        let symbols = state.repository.get_symbols_for_file(&file.id)?;
        all_symbols.extend(symbols);
    }

    // Apply symbol kind filter
    if !filters.symbol_kinds.is_empty() {
        all_symbols.retain(|s| filters.symbol_kinds.contains(&s.kind));
    }

    // Get relationships
    let relationships = state.repository.get_relationships_for_project(&project_id)?;

    // Build graph
    let graph = GraphData::from_analysis(&files, &all_symbols, &relationships, filters.view_mode);

    tracing::debug!(
        "Graph data: {} nodes, {} edges",
        graph.nodes.len(),
        graph.edges.len()
    );

    Ok(graph)
}

/// Get details for a specific node (file or symbol)
#[tauri::command]
#[tracing::instrument(skip(state))]
pub async fn get_node_details(
    node_id: String,
    state: State<'_, AppState>,
) -> NexusResult<NodeDetails> {
    tracing::debug!("Getting node details for: {}", node_id);

    // Get relationships for this node
    let relationships = state.repository.get_relationships_for_node(&node_id)?;

    // Separate incoming and outgoing relationships
    let incoming: Vec<_> = relationships
        .iter()
        .filter(|r| r.target_id == node_id)
        .cloned()
        .collect();
    let outgoing: Vec<_> = relationships
        .iter()
        .filter(|r| r.source_id == node_id)
        .cloned()
        .collect();

    // Try to find as file first
    if let Some(file) = state.repository.get_file(&node_id)? {
        // Get symbols in this file
        let symbols = state.repository.get_symbols_for_file(&node_id)?;

        return Ok(NodeDetails {
            id: node_id,
            node_type: "file".to_string(),
            file: Some(file),
            symbol: None,
            containing_file: None,
            symbols_in_file: Some(symbols),
            incoming_relationships: incoming,
            outgoing_relationships: outgoing,
        });
    }

    // Try to find as symbol
    if let Some(symbol) = state.repository.get_symbol(&node_id)? {
        // Get the containing file
        let containing_file = state.repository.get_file(&symbol.file_id)?;

        return Ok(NodeDetails {
            id: node_id,
            node_type: "symbol".to_string(),
            file: None,
            symbol: Some(symbol),
            containing_file,
            symbols_in_file: None,
            incoming_relationships: incoming,
            outgoing_relationships: outgoing,
        });
    }

    // Node not found - return minimal details
    Ok(NodeDetails {
        id: node_id,
        node_type: "unknown".to_string(),
        file: None,
        symbol: None,
        containing_file: None,
        symbols_in_file: None,
        incoming_relationships: incoming,
        outgoing_relationships: outgoing,
    })
}

/// Hide or show a file in the graph
#[tauri::command]
#[tracing::instrument(skip(state))]
pub async fn set_file_visibility(
    file_id: String,
    is_hidden: bool,
    state: State<'_, AppState>,
) -> NexusResult<bool> {
    tracing::debug!("Setting file {} visibility to hidden={}", file_id, is_hidden);
    state.repository.set_file_hidden(&file_id, is_hidden)
}

/// Detailed information about a node (file or symbol)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NodeDetails {
    /// The node ID
    pub id: String,
    /// Type of node: "file", "symbol", or "unknown"
    pub node_type: String,
    /// File details (if node is a file)
    pub file: Option<FileRecord>,
    /// Symbol details (if node is a symbol)
    pub symbol: Option<SymbolRecord>,
    /// The file containing this symbol (if node is a symbol)
    pub containing_file: Option<FileRecord>,
    /// Symbols defined in this file (if node is a file)
    pub symbols_in_file: Option<Vec<SymbolRecord>>,
    /// Relationships where this node is the target
    pub incoming_relationships: Vec<RelationshipRecord>,
    /// Relationships where this node is the source
    pub outgoing_relationships: Vec<RelationshipRecord>,
}

#[cfg(test)]
mod tests {
    // Integration tests would require mocking the state
}
