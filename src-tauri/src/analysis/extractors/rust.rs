use tree_sitter::Node;

use super::{create_symbol, find_child, find_children, node_text};
use crate::analysis::parser::{ImportInfo, ParseResult};

/// Extract symbols and relationships from Rust AST
pub fn extract(file_id: &str, root: &Node, source: &[u8], result: &mut ParseResult) {
    let mut cursor = root.walk();

    for child in root.children(&mut cursor) {
        match child.kind() {
            "use_declaration" => extract_use(&child, source, result),
            "function_item" => extract_function(file_id, &child, source, result, None),
            "struct_item" => extract_struct(file_id, &child, source, result),
            "enum_item" => extract_enum(file_id, &child, source, result),
            "trait_item" => extract_trait(file_id, &child, source, result),
            "impl_item" => extract_impl(file_id, &child, source, result),
            "const_item" | "static_item" => extract_const_static(file_id, &child, source, result),
            "type_item" => extract_type_alias(file_id, &child, source, result),
            "mod_item" => extract_mod(file_id, &child, source, result),
            _ => {}
        }
    }
}

fn is_pub(node: &Node) -> bool {
    let mut cursor = node.walk();
    for child in node.children(&mut cursor) {
        if child.kind() == "visibility_modifier" {
            return true;
        }
    }
    false
}

fn extract_use(node: &Node, source: &[u8], result: &mut ParseResult) {
    // Extract use path from argument field
    fn extract_path(node: &Node, source: &[u8]) -> Option<String> {
        match node.kind() {
            "scoped_identifier" | "use_wildcard" | "identifier" | "crate" | "self" | "super" => {
                Some(node_text(node, source).to_string())
            }
            "use_as_clause" => {
                find_child(node, "scoped_identifier")
                    .or_else(|| find_child(node, "identifier"))
                    .map(|n| node_text(&n, source).to_string())
            }
            "use_list" => {
                // Handle { foo, bar }
                let mut cursor = node.walk();
                let parts: Vec<_> = node.children(&mut cursor)
                    .filter_map(|c| extract_path(&c, source))
                    .collect();
                if parts.is_empty() {
                    None
                } else {
                    Some(format!("{{{}}}", parts.join(", ")))
                }
            }
            "scoped_use_list" => {
                // Handle foo::{bar, baz}
                let path = find_child(node, "scoped_identifier")
                    .or_else(|| find_child(node, "identifier"))
                    .map(|n| node_text(&n, source).to_string())
                    .unwrap_or_default();
                let list = find_child(node, "use_list")
                    .and_then(|l| extract_path(&l, source))
                    .unwrap_or_default();
                Some(format!("{}::{}", path, list))
            }
            _ => None,
        }
    }

    // tree-sitter-rust uses "argument" field for the use path
    if let Some(arg_node) = node.child_by_field_name("argument") {
        if let Some(path) = extract_path(&arg_node, source) {
            result.imports.push(ImportInfo {
                source: path,
                imported_names: vec![],
                is_default: false,
                line: node.start_position().row as i32 + 1,
            });
        }
    }
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

    let is_exported = is_pub(node);

    // Build signature
    let params_node = find_child(node, "parameters");
    let params = params_node
        .map(|n| node_text(&n, source).to_string())
        .unwrap_or_else(|| "()".to_string());

    let return_type = find_child(node, "return_type")
        .map(|n| format!(" {}", node_text(&n, source)));

    let async_keyword = if find_child(node, "async").is_some() { "async " } else { "" };

    let signature = format!("{}fn {}{}{}", async_keyword, name, params, return_type.unwrap_or_default());

    result.symbols.push(create_symbol(
        file_id,
        name,
        "function",
        node,
        Some(signature),
        None,
        is_exported,
        parent_id,
    ));
}

fn extract_struct(file_id: &str, node: &Node, source: &[u8], result: &mut ParseResult) {
    let name_node = find_child(node, "type_identifier");
    let name = name_node
        .map(|n| node_text(&n, source))
        .unwrap_or("anonymous");

    let is_exported = is_pub(node);
    let signature = format!("struct {}", name);

    let struct_id = {
        let symbol = create_symbol(
            file_id,
            name,
            "struct",
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

    // Extract fields from field_declaration_list
    if let Some(fields) = find_child(node, "field_declaration_list") {
        let mut cursor = fields.walk();
        for field in fields.children(&mut cursor) {
            if field.kind() == "field_declaration" {
                if let Some(field_name) = find_child(&field, "field_identifier") {
                    result.symbols.push(create_symbol(
                        file_id,
                        node_text(&field_name, source),
                        "field",
                        &field,
                        None,
                        None,
                        is_pub(&field),
                        Some(struct_id.clone()),
                    ));
                }
            }
        }
    }
}

fn extract_enum(file_id: &str, node: &Node, source: &[u8], result: &mut ParseResult) {
    let name_node = find_child(node, "type_identifier");
    let name = name_node
        .map(|n| node_text(&n, source))
        .unwrap_or("anonymous");

    let is_exported = is_pub(node);
    let signature = format!("enum {}", name);

    result.symbols.push(create_symbol(
        file_id,
        name,
        "enum",
        node,
        Some(signature),
        None,
        is_exported,
        None,
    ));
}

fn extract_trait(file_id: &str, node: &Node, source: &[u8], result: &mut ParseResult) {
    let name_node = find_child(node, "type_identifier");
    let name = name_node
        .map(|n| node_text(&n, source))
        .unwrap_or("anonymous");

    let is_exported = is_pub(node);
    let signature = format!("trait {}", name);

    result.symbols.push(create_symbol(
        file_id,
        name,
        "trait",
        node,
        Some(signature),
        None,
        is_exported,
        None,
    ));
}

fn extract_impl(file_id: &str, node: &Node, source: &[u8], result: &mut ParseResult) {
    // Get the type being implemented
    let type_node = find_child(node, "type_identifier")
        .or_else(|| find_child(node, "generic_type"));
    let type_name = type_node
        .map(|n| node_text(&n, source))
        .unwrap_or("anonymous");

    // Check if implementing a trait (may be used in future for relationship tracking)
    let _trait_name = find_children(node, "type_identifier")
        .get(0)
        .map(|n| node_text(n, source).to_string());

    // Extract methods from declaration_list
    if let Some(decl_list) = find_child(node, "declaration_list") {
        let mut cursor = decl_list.walk();
        for item in decl_list.children(&mut cursor) {
            if item.kind() == "function_item" {
                // Create parent_id from impl type
                let parent_id = format!("{}_{}", file_id, type_name);
                extract_function(file_id, &item, source, result, Some(parent_id));
            }
        }
    }
}

fn extract_const_static(file_id: &str, node: &Node, source: &[u8], result: &mut ParseResult) {
    let name_node = find_child(node, "identifier");
    let name = name_node
        .map(|n| node_text(&n, source))
        .unwrap_or("anonymous");

    let is_exported = is_pub(node);
    let kind = if node.kind() == "const_item" { "constant" } else { "variable" };

    result.symbols.push(create_symbol(
        file_id,
        name,
        kind,
        node,
        None,
        None,
        is_exported,
        None,
    ));
}

fn extract_type_alias(file_id: &str, node: &Node, source: &[u8], result: &mut ParseResult) {
    let name_node = find_child(node, "type_identifier");
    let name = name_node
        .map(|n| node_text(&n, source))
        .unwrap_or("anonymous");

    let is_exported = is_pub(node);

    result.symbols.push(create_symbol(
        file_id,
        name,
        "type",
        node,
        Some(format!("type {}", name)),
        None,
        is_exported,
        None,
    ));
}

fn extract_mod(file_id: &str, node: &Node, source: &[u8], result: &mut ParseResult) {
    let name_node = find_child(node, "identifier");
    let name = name_node
        .map(|n| node_text(&n, source))
        .unwrap_or("anonymous");

    let is_exported = is_pub(node);

    result.symbols.push(create_symbol(
        file_id,
        name,
        "module",
        node,
        Some(format!("mod {}", name)),
        None,
        is_exported,
        None,
    ));
}

#[cfg(test)]
mod tests {
    
    use crate::analysis::parser::{Parser, SupportedLanguage};

    #[test]
    fn test_extract_function() {
        let parser = Parser::new();
        let source = r#"
pub fn greet(name: &str) -> String {
    format!("Hello, {}!", name)
}

fn private_func() {}
        "#;

        let result = parser.parse_file("test", SupportedLanguage::Rust, source).unwrap();
        let funcs: Vec<_> = result.symbols.iter().filter(|s| s.kind == "function").collect();
        assert_eq!(funcs.len(), 2);
        assert!(funcs.iter().any(|s| s.name == "greet" && s.is_exported));
        assert!(funcs.iter().any(|s| s.name == "private_func" && !s.is_exported));
    }

    #[test]
    fn test_extract_struct() {
        let parser = Parser::new();
        let source = r#"
pub struct User {
    pub name: String,
    age: u32,
}
        "#;

        let result = parser.parse_file("test", SupportedLanguage::Rust, source).unwrap();
        assert!(result.symbols.iter().any(|s| s.name == "User" && s.kind == "struct"));
    }

    #[test]
    fn test_extract_use() {
        let parser = Parser::new();
        let source = r#"
use std::collections::HashMap;
use serde::{Serialize, Deserialize};
        "#;

        let result = parser.parse_file("test", SupportedLanguage::Rust, source).unwrap();
        assert!(result.imports.len() >= 2);
    }
}
