use tree_sitter::Node;

use super::{create_symbol, find_child, node_text};
use crate::analysis::parser::{ImportInfo, ParseResult};

/// Extract symbols and relationships from Go AST
pub fn extract(file_id: &str, root: &Node, source: &[u8], result: &mut ParseResult) {
    let mut cursor = root.walk();

    for child in root.children(&mut cursor) {
        match child.kind() {
            "import_declaration" => extract_imports(&child, source, result),
            "function_declaration" => extract_function(file_id, &child, source, result),
            "method_declaration" => extract_method(file_id, &child, source, result),
            "type_declaration" => extract_type(file_id, &child, source, result),
            "const_declaration" | "var_declaration" => {
                extract_var_const(file_id, &child, source, result)
            }
            _ => {}
        }
    }
}

fn extract_imports(node: &Node, source: &[u8], result: &mut ParseResult) {
    let mut cursor = node.walk();

    for child in node.children(&mut cursor) {
        if child.kind() == "import_spec" || child.kind() == "import_spec_list" {
            extract_import_specs(&child, source, result);
        }
    }
}

fn extract_import_specs(node: &Node, source: &[u8], result: &mut ParseResult) {
    if node.kind() == "import_spec" {
        extract_single_import(node, source, result);
    } else if node.kind() == "import_spec_list" {
        let mut cursor = node.walk();
        for child in node.children(&mut cursor) {
            if child.kind() == "import_spec" {
                extract_single_import(&child, source, result);
            }
        }
    }
}

fn extract_single_import(node: &Node, source: &[u8], result: &mut ParseResult) {
    let path_node = find_child(node, "interpreted_string_literal");
    let path = path_node
        .map(|n| {
            let text = node_text(&n, source);
            text.trim_matches('"').to_string()
        })
        .unwrap_or_default();

    if !path.is_empty() {
        result.imports.push(ImportInfo {
            source: path,
            imported_names: vec![],
            is_default: true,
            line: node.start_position().row as i32 + 1,
        });
    }
}

fn extract_function(file_id: &str, node: &Node, source: &[u8], result: &mut ParseResult) {
    let name_node = find_child(node, "identifier");
    let name = name_node
        .map(|n| node_text(&n, source))
        .unwrap_or("anonymous");

    // In Go, exported names start with uppercase
    let is_exported = name.chars().next().map(|c| c.is_uppercase()).unwrap_or(false);

    // Build signature
    let params_node = find_child(node, "parameter_list");
    let params = params_node
        .map(|n| node_text(&n, source).to_string())
        .unwrap_or_else(|| "()".to_string());

    let return_type = find_child(node, "result")
        .map(|n| format!(" {}", node_text(&n, source)));

    let signature = format!("func {}{}{}", name, params, return_type.unwrap_or_default());

    result.symbols.push(create_symbol(
        file_id,
        name,
        "function",
        node,
        Some(signature),
        None,
        is_exported,
        None,
    ));
}

fn extract_method(file_id: &str, node: &Node, source: &[u8], result: &mut ParseResult) {
    let name_node = find_child(node, "field_identifier");
    let name = name_node
        .map(|n| node_text(&n, source))
        .unwrap_or("anonymous");

    // Get receiver type
    let receiver = if let Some(param_list) = find_child(node, "parameter_list") {
        let mut cursor = param_list.walk();
        let param_decl = param_list.children(&mut cursor)
            .find(|c| c.kind() == "parameter_declaration");
        if let Some(pd) = param_decl {
            find_child(&pd, "type_identifier")
                .or_else(|| find_child(&pd, "pointer_type"))
                .map(|t| node_text(&t, source).to_string())
        } else {
            None
        }
    } else {
        None
    };

    let is_exported = name.chars().next().map(|c| c.is_uppercase()).unwrap_or(false);

    let signature = if let Some(recv) = receiver {
        format!("func ({}) {}", recv, name)
    } else {
        format!("func {}", name)
    };

    result.symbols.push(create_symbol(
        file_id,
        name,
        "method",
        node,
        Some(signature),
        None,
        is_exported,
        None,
    ));
}

fn extract_type(file_id: &str, node: &Node, source: &[u8], result: &mut ParseResult) {
    let mut cursor = node.walk();

    for child in node.children(&mut cursor) {
        if child.kind() == "type_spec" {
            let name_node = find_child(&child, "type_identifier");
            let name = name_node
                .map(|n| node_text(&n, source))
                .unwrap_or("anonymous");

            let is_exported = name.chars().next().map(|c| c.is_uppercase()).unwrap_or(false);

            // Determine if it's a struct or interface
            let type_def = find_child(&child, "struct_type")
                .map(|_| "struct")
                .or_else(|| find_child(&child, "interface_type").map(|_| "interface"))
                .unwrap_or("type");

            let signature = format!("type {} {}", name, type_def);

            result.symbols.push(create_symbol(
                file_id,
                name,
                type_def,
                &child,
                Some(signature),
                None,
                is_exported,
                None,
            ));
        }
    }
}

fn extract_var_const(file_id: &str, node: &Node, source: &[u8], result: &mut ParseResult) {
    let kind = if node.kind() == "const_declaration" {
        "constant"
    } else {
        "variable"
    };

    let mut cursor = node.walk();

    for child in node.children(&mut cursor) {
        if child.kind() == "const_spec" || child.kind() == "var_spec" {
            if let Some(name_node) = find_child(&child, "identifier") {
                let name = node_text(&name_node, source);
                let is_exported = name.chars().next().map(|c| c.is_uppercase()).unwrap_or(false);

                result.symbols.push(create_symbol(
                    file_id,
                    name,
                    kind,
                    &child,
                    None,
                    None,
                    is_exported,
                    None,
                ));
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
package main

func Greet(name string) string {
    return "Hello, " + name + "!"
}

func privateFunc() {}
        "#;

        let result = parser.parse_file("test", SupportedLanguage::Go, source).unwrap();
        let funcs: Vec<_> = result.symbols.iter().filter(|s| s.kind == "function").collect();
        assert_eq!(funcs.len(), 2);
        assert!(funcs.iter().any(|s| s.name == "Greet" && s.is_exported));
        assert!(funcs.iter().any(|s| s.name == "privateFunc" && !s.is_exported));
    }

    #[test]
    fn test_extract_struct() {
        let parser = Parser::new();
        let source = r#"
package main

type User struct {
    Name string
    Age  int
}
        "#;

        let result = parser.parse_file("test", SupportedLanguage::Go, source).unwrap();
        assert!(result.symbols.iter().any(|s| s.name == "User" && s.kind == "struct"));
    }

    #[test]
    fn test_extract_imports() {
        let parser = Parser::new();
        let source = r#"
package main

import (
    "fmt"
    "os"
)
        "#;

        let result = parser.parse_file("test", SupportedLanguage::Go, source).unwrap();
        assert!(result.imports.len() >= 2);
    }
}
