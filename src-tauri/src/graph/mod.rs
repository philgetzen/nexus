use serde::{Deserialize, Serialize};

use crate::storage::{FileRecord, RelationshipRecord, SymbolRecord};

/// Graph data returned to frontend
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GraphData {
    pub nodes: Vec<GraphNode>,
    pub edges: Vec<GraphEdge>,
}

/// Node in the graph (file or symbol) - aligned with frontend types
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GraphNode {
    /// Unique identifier (same as File.id or Symbol.id)
    pub id: String,
    /// Display name
    pub name: String,
    /// Type of node: "file" or "symbol"
    #[serde(rename = "type")]
    pub node_type: String,
    /// Programming language (for file nodes)
    pub language: Option<String>,
    /// Symbol kind (for symbol nodes)
    pub symbol_kind: Option<String>,
    /// File path (for file nodes)
    pub path: Option<String>,
    /// Line number (for symbol nodes)
    pub line: Option<i32>,
    /// Number of lines (for file nodes)
    pub line_count: Option<i32>,
    /// Whether this symbol is exported/public
    pub is_exported: bool,
    /// Number of connections (for sizing)
    pub connection_count: i32,
    /// Visual state - frontend manages position, we provide initial state
    #[serde(default = "default_node_state")]
    pub state: String,
}

fn default_node_state() -> String {
    "default".to_string()
}

/// Edge in the graph (relationship)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GraphEdge {
    pub id: String,
    pub source: String,
    pub target: String,
    #[serde(rename = "type")]
    pub edge_type: String,
}

impl GraphData {
    /// Build graph data from analysis results
    pub fn from_analysis(
        files: &[FileRecord],
        symbols: &[SymbolRecord],
        relationships: &[RelationshipRecord],
        view_mode: ViewMode,
    ) -> Self {
        let mut nodes = Vec::new();
        let mut edges = Vec::new();

        // Count connections for each node
        let mut connection_counts: std::collections::HashMap<String, i32> = std::collections::HashMap::new();
        for rel in relationships {
            *connection_counts.entry(rel.source_id.clone()).or_insert(0) += 1;
            *connection_counts.entry(rel.target_id.clone()).or_insert(0) += 1;
        }

        match view_mode {
            ViewMode::File => {
                // Only show files as nodes
                for file in files {
                    if file.is_hidden {
                        continue;
                    }

                    nodes.push(GraphNode {
                        id: file.id.clone(),
                        name: file.name.clone(),
                        node_type: "file".to_string(),
                        language: Some(file.language.clone()),
                        symbol_kind: None,
                        path: Some(file.path.clone()),
                        line: None,
                        line_count: Some(file.line_count),
                        is_exported: true,
                        connection_count: *connection_counts.get(&file.id).unwrap_or(&0),
                        state: "default".to_string(),
                    });
                }

                // Only include file-to-file relationships
                let file_ids: std::collections::HashSet<_> = files.iter().map(|f| &f.id).collect();
                for rel in relationships {
                    if file_ids.contains(&rel.source_id) && file_ids.contains(&rel.target_id) {
                        edges.push(GraphEdge {
                            id: rel.id.clone(),
                            source: rel.source_id.clone(),
                            target: rel.target_id.clone(),
                            edge_type: rel.kind.clone(),
                        });
                    }
                }
            }
            ViewMode::Symbol => {
                // Show symbols as nodes
                for symbol in symbols {
                    nodes.push(GraphNode {
                        id: symbol.id.clone(),
                        name: symbol.name.clone(),
                        node_type: "symbol".to_string(),
                        language: None,
                        symbol_kind: Some(symbol.kind.clone()),
                        path: None,
                        line: Some(symbol.line),
                        line_count: None,
                        is_exported: symbol.is_exported,
                        connection_count: *connection_counts.get(&symbol.id).unwrap_or(&0),
                        state: "default".to_string(),
                    });
                }

                // Include all relationships
                for rel in relationships {
                    edges.push(GraphEdge {
                        id: rel.id.clone(),
                        source: rel.source_id.clone(),
                        target: rel.target_id.clone(),
                        edge_type: rel.kind.clone(),
                    });
                }
            }
        }

        GraphData { nodes, edges }
    }
}

/// View mode for the graph
#[derive(Debug, Clone, Copy, Serialize, Deserialize, Default)]
#[serde(rename_all = "lowercase")]
pub enum ViewMode {
    #[default]
    File,
    Symbol,
}

/// Filter state for graph queries - aligned with frontend types
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct FilterState {
    /// View mode: file or symbol level
    #[serde(default)]
    pub view_mode: ViewMode,
    /// Languages to show (empty = all)
    #[serde(default)]
    pub languages: Vec<String>,
    /// Node types to show: "file" or "symbol"
    #[serde(default)]
    pub node_types: Vec<String>,
    /// Relationship types to show: "imports", "exports", "calls", etc.
    #[serde(default)]
    pub relationship_types: Vec<String>,
    /// Symbol kinds to filter by
    #[serde(default)]
    pub symbol_kinds: Vec<String>,
    /// Clusters to show (empty = all)
    #[serde(default)]
    pub clusters: Vec<String>,
    /// Search query for filtering nodes by name
    #[serde(default)]
    pub search_query: Option<String>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_graph_data_file_mode() {
        let files = vec![
            FileRecord {
                id: "file-1".to_string(),
                project_id: "proj".to_string(),
                name: "app.ts".to_string(),
                path: "src/app.ts".to_string(),
                absolute_path: "/src/app.ts".to_string(),
                language: "typescript".to_string(),
                line_count: 100,
                is_hidden: false,
                content_hash: None,
                last_modified: None,
            },
            FileRecord {
                id: "file-2".to_string(),
                project_id: "proj".to_string(),
                name: "utils.ts".to_string(),
                path: "src/utils.ts".to_string(),
                absolute_path: "/src/utils.ts".to_string(),
                language: "typescript".to_string(),
                line_count: 50,
                is_hidden: false,
                content_hash: None,
                last_modified: None,
            },
        ];

        let relationships = vec![RelationshipRecord {
            id: "rel-1".to_string(),
            source_id: "file-1".to_string(),
            target_id: "file-2".to_string(),
            kind: "imports".to_string(),
            metadata: None,
        }];

        let graph = GraphData::from_analysis(&files, &[], &relationships, ViewMode::File);

        assert_eq!(graph.nodes.len(), 2);
        assert_eq!(graph.edges.len(), 1);
    }
}
