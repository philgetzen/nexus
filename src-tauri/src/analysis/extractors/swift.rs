use tree_sitter::Node;

use super::{create_symbol, find_child, node_text};
use crate::analysis::parser::{ImportInfo, ParseResult};

/// Extract symbols and relationships from Swift AST
pub fn extract(file_id: &str, root: &Node, source: &[u8], result: &mut ParseResult) {
    extract_node(file_id, root, source, result, None);
}

fn extract_node(
    file_id: &str,
    node: &Node,
    source: &[u8],
    result: &mut ParseResult,
    parent_id: Option<String>,
) {
    let mut cursor = node.walk();

    for child in node.children(&mut cursor) {
        match child.kind() {
            "import_declaration" => extract_import(&child, source, result),
            "class_declaration" => extract_class(file_id, &child, source, result, parent_id.clone()),
            "struct_declaration" => extract_struct(file_id, &child, source, result, parent_id.clone()),
            "enum_declaration" => extract_enum(file_id, &child, source, result, parent_id.clone()),
            "protocol_declaration" => extract_protocol(file_id, &child, source, result, parent_id.clone()),
            "function_declaration" => extract_function(file_id, &child, source, result, parent_id.clone()),
            "property_declaration" => extract_property(file_id, &child, source, result, parent_id.clone()),
            "typealias_declaration" => extract_typealias(file_id, &child, source, result, parent_id.clone()),
            "extension_declaration" => extract_extension(file_id, &child, source, result),
            _ => {
                // Recurse into other node types
                extract_node(file_id, &child, source, result, parent_id.clone());
            }
        }
    }
}

fn extract_import(node: &Node, source: &[u8], result: &mut ParseResult) {
    // Get the module name from import declaration
    let mut cursor = node.walk();
    for child in node.children(&mut cursor) {
        if child.kind() == "identifier" || child.kind() == "simple_identifier" {
            let module_name = node_text(&child, source);
            result.imports.push(ImportInfo {
                source: module_name.to_string(),
                imported_names: vec![],
                is_default: true,
                line: node.start_position().row as i32 + 1,
            });
            break;
        }
    }
}

fn extract_class(
    file_id: &str,
    node: &Node,
    source: &[u8],
    result: &mut ParseResult,
    _parent_id: Option<String>,
) {
    let name = get_type_name(node, source);
    let is_public = is_exported(node, source);

    let symbol = create_symbol(
        file_id,
        &name,
        "class",
        node,
        Some(format!("class {}", name)),
        None,
        is_public,
        None,
    );

    let symbol_id = symbol.id.clone();
    result.symbols.push(symbol);

    // Extract members
    if let Some(body) = find_child(node, "class_body") {
        extract_node(file_id, &body, source, result, Some(symbol_id));
    }
}

fn extract_struct(
    file_id: &str,
    node: &Node,
    source: &[u8],
    result: &mut ParseResult,
    _parent_id: Option<String>,
) {
    let name = get_type_name(node, source);
    let is_public = is_exported(node, source);

    let symbol = create_symbol(
        file_id,
        &name,
        "class", // Use "class" for struct to match frontend types
        node,
        Some(format!("struct {}", name)),
        None,
        is_public,
        None,
    );

    let symbol_id = symbol.id.clone();
    result.symbols.push(symbol);

    // Extract members
    if let Some(body) = find_child(node, "struct_body") {
        extract_node(file_id, &body, source, result, Some(symbol_id));
    }
}

fn extract_enum(
    file_id: &str,
    node: &Node,
    source: &[u8],
    result: &mut ParseResult,
    _parent_id: Option<String>,
) {
    let name = get_type_name(node, source);
    let is_public = is_exported(node, source);

    let symbol = create_symbol(
        file_id,
        &name,
        "enum",
        node,
        Some(format!("enum {}", name)),
        None,
        is_public,
        None,
    );

    let symbol_id = symbol.id.clone();
    result.symbols.push(symbol);

    // Extract cases
    if let Some(body) = find_child(node, "enum_body") {
        extract_node(file_id, &body, source, result, Some(symbol_id));
    }
}

fn extract_protocol(
    file_id: &str,
    node: &Node,
    source: &[u8],
    result: &mut ParseResult,
    _parent_id: Option<String>,
) {
    let name = get_type_name(node, source);
    let is_public = is_exported(node, source);

    let symbol = create_symbol(
        file_id,
        &name,
        "interface",
        node,
        Some(format!("protocol {}", name)),
        None,
        is_public,
        None,
    );

    let symbol_id = symbol.id.clone();
    result.symbols.push(symbol);

    // Extract protocol members
    if let Some(body) = find_child(node, "protocol_body") {
        extract_node(file_id, &body, source, result, Some(symbol_id));
    }
}

fn extract_function(
    file_id: &str,
    node: &Node,
    source: &[u8],
    result: &mut ParseResult,
    parent_id: Option<String>,
) {
    let name = get_function_name(node, source);
    let is_public = is_exported(node, source);
    let kind = if parent_id.is_some() { "method" } else { "function" };

    // Build signature
    let signature = build_function_signature(node, source);

    result.symbols.push(create_symbol(
        file_id,
        &name,
        kind,
        node,
        Some(signature),
        None,
        is_public,
        parent_id,
    ));
}

fn extract_property(
    file_id: &str,
    node: &Node,
    source: &[u8],
    result: &mut ParseResult,
    parent_id: Option<String>,
) {
    // Get property name
    let name = find_property_name(node, source);
    let is_public = is_exported(node, source);

    // Determine if it's a constant (let) or variable (var)
    let is_constant = node_text(node, source).trim_start().starts_with("let");
    let kind = if is_constant { "constant" } else { "variable" };

    result.symbols.push(create_symbol(
        file_id,
        &name,
        kind,
        node,
        None,
        None,
        is_public,
        parent_id,
    ));
}

fn extract_typealias(
    file_id: &str,
    node: &Node,
    source: &[u8],
    result: &mut ParseResult,
    parent_id: Option<String>,
) {
    let name = get_type_name(node, source);
    let is_public = is_exported(node, source);

    result.symbols.push(create_symbol(
        file_id,
        &name,
        "type",
        node,
        Some(format!("typealias {}", name)),
        None,
        is_public,
        parent_id,
    ));
}

fn extract_extension(
    file_id: &str,
    node: &Node,
    source: &[u8],
    result: &mut ParseResult,
) {
    // Extensions don't create new symbols, but we need to extract their contents
    // Try to find the extended type name
    if let Some(body) = find_child(node, "extension_body") {
        extract_node(file_id, &body, source, result, None);
    }
}

// Helper functions

fn get_type_name(node: &Node, source: &[u8]) -> String {
    // Look for type_identifier or simple_identifier
    let mut cursor = node.walk();
    for child in node.children(&mut cursor) {
        match child.kind() {
            "type_identifier" | "simple_identifier" | "identifier" => {
                return node_text(&child, source).to_string();
            }
            _ => {}
        }
    }
    "anonymous".to_string()
}

fn get_function_name(node: &Node, source: &[u8]) -> String {
    // Look for simple_identifier in function declaration
    let mut cursor = node.walk();
    for child in node.children(&mut cursor) {
        if child.kind() == "simple_identifier" || child.kind() == "identifier" {
            return node_text(&child, source).to_string();
        }
    }
    "anonymous".to_string()
}

fn find_property_name(node: &Node, source: &[u8]) -> String {
    // Look for pattern which contains the property name
    let mut cursor = node.walk();
    for child in node.children(&mut cursor) {
        if child.kind() == "pattern" || child.kind() == "simple_identifier" || child.kind() == "identifier" {
            let text = node_text(&child, source);
            if !text.is_empty() {
                return text.to_string();
            }
        }
    }
    "anonymous".to_string()
}

fn build_function_signature(node: &Node, source: &[u8]) -> String {
    let name = get_function_name(node, source);

    // Get parameters if present
    let params = find_child(node, "parameter_clause")
        .map(|n| node_text(&n, source))
        .unwrap_or("()");

    // Get return type if present
    let return_type = find_child(node, "function_type")
        .or_else(|| find_child(node, "type_annotation"))
        .map(|n| format!(" -> {}", node_text(&n, source)))
        .unwrap_or_default();

    format!("func {}{}{}", name, params, return_type)
}

fn is_exported(node: &Node, source: &[u8]) -> bool {
    // In Swift, internal is the default. public/open are exported.
    let text = node_text(node, source);
    text.contains("public ") || text.contains("open ") || text.starts_with("public ") || text.starts_with("open ")
}
