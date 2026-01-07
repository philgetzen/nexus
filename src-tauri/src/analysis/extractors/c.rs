use tree_sitter::Node;

use super::{create_symbol, find_child, node_text};
use crate::analysis::parser::{ImportInfo, ParseResult};

/// Extract symbols and relationships from C AST
pub fn extract(file_id: &str, root: &Node, source: &[u8], result: &mut ParseResult) {
    let mut cursor = root.walk();

    for child in root.children(&mut cursor) {
        match child.kind() {
            "preproc_include" => extract_include(&child, source, result),
            "function_definition" => extract_function(file_id, &child, source, result),
            "declaration" => extract_declaration(file_id, &child, source, result),
            "struct_specifier" | "union_specifier" | "enum_specifier" => {
                // Only extract if it's a definition (has field_declaration_list)
                if find_child(&child, "field_declaration_list").is_some()
                    || find_child(&child, "enumerator_list").is_some()
                {
                    extract_type_def(file_id, &child, source, result);
                }
            }
            "type_definition" => extract_typedef(file_id, &child, source, result),
            _ => {}
        }
    }
}

fn extract_include(node: &Node, source: &[u8], result: &mut ParseResult) {
    // Get the include path
    let path_node = find_child(node, "string_literal")
        .or_else(|| find_child(node, "system_lib_string"));

    if let Some(path) = path_node {
        let path_text = node_text(&path, source);
        // Remove quotes or angle brackets
        let cleaned = path_text
            .trim_matches(|c| c == '"' || c == '<' || c == '>');

        result.imports.push(ImportInfo {
            source: cleaned.to_string(),
            imported_names: vec![],
            is_default: true,
            line: node.start_position().row as i32 + 1,
        });
    }
}

fn extract_function(file_id: &str, node: &Node, source: &[u8], result: &mut ParseResult) {
    // Get declarator which contains function name
    let declarator = find_child(node, "function_declarator");
    if declarator.is_none() {
        return;
    }
    let declarator = declarator.unwrap();

    let name_node = find_child(&declarator, "identifier")
        .or_else(|| find_child(&declarator, "field_identifier"));
    let name = name_node
        .map(|n| node_text(&n, source))
        .unwrap_or("anonymous");

    // Get return type
    let return_type = find_child(node, "primitive_type")
        .or_else(|| find_child(node, "type_identifier"))
        .map(|n| node_text(&n, source).to_string())
        .unwrap_or_else(|| "void".to_string());

    // Get parameters
    let params = find_child(&declarator, "parameter_list")
        .map(|n| node_text(&n, source).to_string())
        .unwrap_or_else(|| "()".to_string());

    let signature = format!("{} {}{}", return_type, name, params);

    // In C, functions not marked static are exported
    let is_static = node_text(node, source).starts_with("static");

    result.symbols.push(create_symbol(
        file_id,
        name,
        "function",
        node,
        Some(signature),
        None,
        !is_static,
        None,
    ));
}

fn extract_declaration(file_id: &str, node: &Node, source: &[u8], result: &mut ParseResult) {
    // Check if it's a function declaration (prototype)
    let mut cursor = node.walk();
    for child in node.children(&mut cursor) {
        if child.kind() == "function_declarator" {
            // This is a function prototype
            let name_node = find_child(&child, "identifier");
            let name = name_node
                .map(|n| node_text(&n, source))
                .unwrap_or("anonymous");

            result.symbols.push(create_symbol(
                file_id,
                name,
                "function",
                node,
                None,
                None,
                true,
                None,
            ));
            return;
        }
    }

    // Check for variable declarations
    let mut cursor = node.walk();
    for child in node.children(&mut cursor) {
        if child.kind() == "init_declarator" || child.kind() == "identifier" {
            let name_node = if child.kind() == "init_declarator" {
                find_child(&child, "identifier")
            } else {
                Some(child)
            };

            if let Some(name_node) = name_node {
                let name = node_text(&name_node, source);
                let is_static = node_text(node, source).starts_with("static");
                let is_const = node_text(node, source).contains("const");

                let kind = if is_const { "constant" } else { "variable" };

                result.symbols.push(create_symbol(
                    file_id,
                    name,
                    kind,
                    node,
                    None,
                    None,
                    !is_static,
                    None,
                ));
            }
        }
    }
}

fn extract_type_def(file_id: &str, node: &Node, source: &[u8], result: &mut ParseResult) {
    let kind = match node.kind() {
        "struct_specifier" => "struct",
        "union_specifier" => "union",
        "enum_specifier" => "enum",
        _ => "type",
    };

    let name_node = find_child(node, "type_identifier");
    let name = name_node
        .map(|n| node_text(&n, source))
        .unwrap_or("anonymous");

    let signature = format!("{} {}", kind, name);

    result.symbols.push(create_symbol(
        file_id,
        name,
        kind,
        node,
        Some(signature),
        None,
        true,
        None,
    ));
}

fn extract_typedef(file_id: &str, node: &Node, source: &[u8], result: &mut ParseResult) {
    // Get the name being defined (last identifier in typedef)
    let mut cursor = node.walk();
    let identifiers: Vec<_> = node
        .children(&mut cursor)
        .filter(|c| c.kind() == "type_identifier")
        .collect();

    if let Some(name_node) = identifiers.last() {
        let name = node_text(name_node, source);

        result.symbols.push(create_symbol(
            file_id,
            name,
            "type",
            node,
            Some(format!("typedef {}", name)),
            None,
            true,
            None,
        ));
    }
}

#[cfg(test)]
mod tests {
    
    use crate::analysis::parser::{Parser, SupportedLanguage};

    #[test]
    fn test_extract_function() {
        let parser = Parser::new();
        let source = r#"
int greet(const char* name) {
    printf("Hello, %s!\n", name);
    return 0;
}

static void private_func(void) {}
        "#;

        let result = parser.parse_file("test", SupportedLanguage::C, source).unwrap();
        let funcs: Vec<_> = result.symbols.iter().filter(|s| s.kind == "function").collect();
        assert!(funcs.len() >= 1);
        assert!(funcs.iter().any(|s| s.name == "greet"));
    }

    #[test]
    fn test_extract_struct() {
        let parser = Parser::new();
        let source = r#"
struct User {
    char* name;
    int age;
};
        "#;

        let result = parser.parse_file("test", SupportedLanguage::C, source).unwrap();
        assert!(result.symbols.iter().any(|s| s.name == "User" && s.kind == "struct"));
    }

    #[test]
    fn test_extract_includes() {
        let parser = Parser::new();
        let source = r#"
#include <stdio.h>
#include "myheader.h"
        "#;

        let result = parser.parse_file("test", SupportedLanguage::C, source).unwrap();
        assert!(result.imports.len() >= 2);
        assert!(result.imports.iter().any(|i| i.source == "stdio.h"));
        assert!(result.imports.iter().any(|i| i.source == "myheader.h"));
    }
}
