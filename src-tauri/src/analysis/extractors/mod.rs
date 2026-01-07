pub mod typescript;
pub mod python;
pub mod go;
pub mod rust;
pub mod c;
pub mod swift;

use tree_sitter::Node;
use uuid::Uuid;

use crate::storage::SymbolRecord;

/// Helper to get text from a node
pub fn node_text<'a>(node: &Node, source: &'a [u8]) -> &'a str {
    node.utf8_text(source).unwrap_or("")
}

/// Helper to create a symbol record
pub fn create_symbol(
    file_id: &str,
    name: &str,
    kind: &str,
    node: &Node,
    signature: Option<String>,
    documentation: Option<String>,
    is_exported: bool,
    parent_id: Option<String>,
) -> SymbolRecord {
    SymbolRecord {
        id: Uuid::new_v4().to_string(),
        file_id: file_id.to_string(),
        name: name.to_string(),
        kind: kind.to_string(),
        line: node.start_position().row as i32 + 1,
        column: node.start_position().column as i32 + 1,
        end_line: Some(node.end_position().row as i32 + 1),
        end_column: Some(node.end_position().column as i32 + 1),
        signature,
        documentation,
        is_exported,
        parent_id,
    }
}

/// Helper to find the first child with a given type
pub fn find_child<'a>(node: &'a Node, kind: &str) -> Option<Node<'a>> {
    let mut cursor = node.walk();
    for child in node.children(&mut cursor) {
        if child.kind() == kind {
            return Some(child);
        }
    }
    None
}

/// Helper to find all children with a given type
pub fn find_children<'a>(node: &'a Node, kind: &str) -> Vec<Node<'a>> {
    let mut cursor = node.walk();
    node.children(&mut cursor)
        .filter(|child| child.kind() == kind)
        .collect()
}

/// Helper to find the first descendant with a given type
pub fn find_descendant<'a>(node: &'a Node, kind: &str) -> Option<Node<'a>> {
    let mut cursor = node.walk();

    loop {
        let current = cursor.node();
        if current.kind() == kind {
            return Some(current);
        }

        // Try to go to first child
        if cursor.goto_first_child() {
            continue;
        }

        // Try to go to next sibling
        loop {
            if cursor.goto_next_sibling() {
                break;
            }
            // Go back up
            if !cursor.goto_parent() {
                return None;
            }
        }
    }
}
