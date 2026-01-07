use tree_sitter::Node;

use super::{create_symbol, find_child, find_children, node_text};
use crate::analysis::parser::{ImportInfo, ParseResult};

/// Extract symbols and relationships from Python AST
pub fn extract(file_id: &str, root: &Node, source: &[u8], result: &mut ParseResult) {
    let mut cursor = root.walk();

    for child in root.children(&mut cursor) {
        match child.kind() {
            "import_statement" => extract_import(&child, source, result),
            "import_from_statement" => extract_import_from(&child, source, result),
            "function_definition" => extract_function(file_id, &child, source, result, None),
            "class_definition" => extract_class(file_id, &child, source, result),
            "decorated_definition" => {
                // Handle decorated functions/classes
                if let Some(def) = find_child(&child, "function_definition") {
                    extract_function(file_id, &def, source, result, None);
                } else if let Some(def) = find_child(&child, "class_definition") {
                    extract_class(file_id, &def, source, result);
                }
            }
            _ => {}
        }
    }
}

fn extract_import(node: &Node, source: &[u8], result: &mut ParseResult) {
    // import foo, bar
    let mut cursor = node.walk();
    for child in node.children(&mut cursor) {
        if child.kind() == "dotted_name" || child.kind() == "aliased_import" {
            let module_name = if child.kind() == "aliased_import" {
                find_child(&child, "dotted_name")
                    .map(|n| node_text(&n, source).to_string())
                    .unwrap_or_default()
            } else {
                node_text(&child, source).to_string()
            };

            if !module_name.is_empty() {
                result.imports.push(ImportInfo {
                    source: module_name,
                    imported_names: vec![],
                    is_default: true,
                    line: node.start_position().row as i32 + 1,
                });
            }
        }
    }
}

fn extract_import_from(node: &Node, source: &[u8], result: &mut ParseResult) {
    // from foo import bar, baz
    let module_node = find_child(node, "dotted_name")
        .or_else(|| find_child(node, "relative_import"));
    let module_name = module_node
        .map(|n| node_text(&n, source).to_string())
        .unwrap_or_default();

    if module_name.is_empty() {
        return;
    }

    let mut imported_names = Vec::new();

    // Check for wildcard import
    let mut cursor = node.walk();
    for child in node.children(&mut cursor) {
        if child.kind() == "wildcard_import" {
            imported_names.push("*".to_string());
        } else if child.kind() == "import_prefix" {
            // Skip the "from" keyword handling
        }
    }

    // Named imports
    let import_list = find_children(node, "dotted_name")
        .into_iter()
        .skip(1) // Skip module name
        .chain(find_children(node, "aliased_import"));

    for import_node in import_list {
        let name = if import_node.kind() == "aliased_import" {
            find_child(&import_node, "identifier")
                .map(|n| node_text(&n, source).to_string())
                .unwrap_or_default()
        } else {
            node_text(&import_node, source).to_string()
        };

        if !name.is_empty() && name != module_name {
            imported_names.push(name);
        }
    }

    result.imports.push(ImportInfo {
        source: module_name,
        imported_names,
        is_default: false,
        line: node.start_position().row as i32 + 1,
    });
}

fn extract_function(
    file_id: &str,
    node: &Node,
    source: &[u8],
    result: &mut ParseResult,
    parent_id: Option<String>,
) {
    let name_node = find_child(node, "identifier");
    let name = name_node
        .map(|n| node_text(&n, source))
        .unwrap_or("anonymous");

    // Skip private methods that start with underscore (unless __init__)
    let is_exported = !name.starts_with('_') || name == "__init__";

    // Build signature
    let params_node = find_child(node, "parameters");
    let params = params_node
        .map(|n| node_text(&n, source).to_string())
        .unwrap_or_else(|| "()".to_string());

    let return_type = find_child(node, "type")
        .map(|n| format!(" -> {}", node_text(&n, source)));

    let signature = format!("def {}{}{}", name, params, return_type.unwrap_or_default());

    // Get docstring if present
    let documentation = if let Some(block) = find_child(node, "block") {
        let mut block_cursor = block.walk();
        let first_child = block.children(&mut block_cursor).next();
        if let Some(first) = first_child {
            if first.kind() == "expression_statement" {
                find_child(&first, "string").map(|s| {
                    let text = node_text(&s, source);
                    text.trim_matches(|c| c == '"' || c == '\'').to_string()
                })
            } else {
                None
            }
        } else {
            None
        }
    } else {
        None
    };

    result.symbols.push(create_symbol(
        file_id,
        name,
        "function",
        node,
        Some(signature),
        documentation,
        is_exported,
        parent_id,
    ));
}

fn extract_class(file_id: &str, node: &Node, source: &[u8], result: &mut ParseResult) {
    let name_node = find_child(node, "identifier");
    let name = name_node
        .map(|n| node_text(&n, source))
        .unwrap_or("anonymous");

    // Check for base classes
    let bases = find_child(node, "argument_list")
        .map(|args| {
            let mut args_cursor = args.walk();
            args.children(&mut args_cursor)
                .filter(|c| c.kind() == "identifier")
                .map(|c| node_text(&c, source).to_string())
                .collect::<Vec<_>>()
                .join(", ")
        });

    let signature = if let Some(bases) = bases {
        if bases.is_empty() {
            format!("class {}", name)
        } else {
            format!("class {}({})", name, bases)
        }
    } else {
        format!("class {}", name)
    };

    let is_exported = !name.starts_with('_');

    let class_id = {
        let symbol = create_symbol(
            file_id,
            name,
            "class",
            node,
            Some(signature),
            None,
            is_exported,
            None,
        );
        let id = symbol.id.clone();
        result.symbols.push(symbol);
        id
    };

    // Extract class body methods
    if let Some(body) = find_child(node, "block") {
        let mut body_cursor = body.walk();
        for member in body.children(&mut body_cursor) {
            match member.kind() {
                "function_definition" => {
                    extract_function(file_id, &member, source, result, Some(class_id.clone()));
                }
                "decorated_definition" => {
                    if let Some(func) = find_child(&member, "function_definition") {
                        extract_function(file_id, &func, source, result, Some(class_id.clone()));
                    }
                }
                _ => {}
            }
        }
    }
}

#[cfg(test)]
mod tests {
    
    use crate::analysis::parser::{Parser, SupportedLanguage};

    #[test]
    fn test_extract_function() {
        let parser = Parser::new();
        let source = r#"
def greet(name: str) -> str:
    """Greet someone."""
    return f"Hello, {name}!"
        "#;

        let result = parser.parse_file("test", SupportedLanguage::Python, source).unwrap();
        assert_eq!(result.symbols.len(), 1);
        assert_eq!(result.symbols[0].name, "greet");
        assert_eq!(result.symbols[0].kind, "function");
    }

    #[test]
    fn test_extract_class() {
        let parser = Parser::new();
        let source = r#"
class User:
    def __init__(self, name: str):
        self.name = name

    def greet(self) -> str:
        return f"Hello, {self.name}!"
        "#;

        let result = parser.parse_file("test", SupportedLanguage::Python, source).unwrap();
        assert!(result.symbols.len() >= 1);
        assert_eq!(result.symbols[0].name, "User");
        assert_eq!(result.symbols[0].kind, "class");
    }

    #[test]
    fn test_extract_imports() {
        let parser = Parser::new();
        let source = r#"
import os
from typing import List, Optional
from .utils import helper
        "#;

        let result = parser.parse_file("test", SupportedLanguage::Python, source).unwrap();
        assert!(result.imports.len() >= 2);
    }
}
