use tree_sitter::Node;

use super::{create_symbol, find_child, node_text};
use crate::analysis::parser::{ExportInfo, ImportInfo, ParseResult};

/// Extract symbols and relationships from TypeScript/JavaScript AST
pub fn extract(file_id: &str, root: &Node, source: &[u8], result: &mut ParseResult) {
    let mut cursor = root.walk();

    for child in root.children(&mut cursor) {
        match child.kind() {
            "import_statement" => extract_import(&child, source, result),
            "export_statement" => extract_export(file_id, &child, source, result),
            "function_declaration" => extract_function(file_id, &child, source, result, false, None),
            "class_declaration" => extract_class(file_id, &child, source, result, false),
            "interface_declaration" => extract_interface(file_id, &child, source, result, false),
            "type_alias_declaration" => extract_type_alias(file_id, &child, source, result, false),
            "enum_declaration" => extract_enum(file_id, &child, source, result, false),
            "lexical_declaration" | "variable_declaration" => {
                extract_variable(file_id, &child, source, result, false)
            }
            _ => {}
        }
    }
}

fn extract_import(node: &Node, source: &[u8], result: &mut ParseResult) {
    // Get import source (the module path)
    let source_node = find_child(node, "string");
    let import_source = source_node
        .map(|n| {
            let text = node_text(&n, source);
            // Remove quotes
            text.trim_matches(|c| c == '"' || c == '\'').to_string()
        })
        .unwrap_or_default();

    if import_source.is_empty() {
        return;
    }

    let mut imported_names = Vec::new();
    let mut is_default = false;

    // Check for import clause
    if let Some(clause) = find_child(node, "import_clause") {
        let mut clause_cursor = clause.walk();
        for child in clause.children(&mut clause_cursor) {
            match child.kind() {
                "identifier" => {
                    // Default import
                    is_default = true;
                    imported_names.push(node_text(&child, source).to_string());
                }
                "named_imports" => {
                    // Named imports: { foo, bar }
                    let mut imports_cursor = child.walk();
                    for import_spec in child.children(&mut imports_cursor) {
                        if import_spec.kind() == "import_specifier" {
                            if let Some(name_node) = find_child(&import_spec, "identifier") {
                                imported_names.push(node_text(&name_node, source).to_string());
                            }
                        }
                    }
                }
                "namespace_import" => {
                    // import * as name
                    if let Some(name_node) = find_child(&child, "identifier") {
                        imported_names.push(format!("* as {}", node_text(&name_node, source)));
                    }
                }
                _ => {}
            }
        }
    }

    result.imports.push(ImportInfo {
        source: import_source,
        imported_names,
        is_default,
        line: node.start_position().row as i32 + 1,
    });
}

fn extract_export(file_id: &str, node: &Node, source: &[u8], result: &mut ParseResult) {
    let mut cursor = node.walk();
    let is_default = node
        .children(&mut cursor)
        .any(|c| c.kind() == "default");

    // Reset cursor
    let mut cursor = node.walk();
    for child in node.children(&mut cursor) {
        match child.kind() {
            "function_declaration" => extract_function(file_id, &child, source, result, true, None),
            "class_declaration" => extract_class(file_id, &child, source, result, true),
            "interface_declaration" => extract_interface(file_id, &child, source, result, true),
            "type_alias_declaration" => extract_type_alias(file_id, &child, source, result, true),
            "enum_declaration" => extract_enum(file_id, &child, source, result, true),
            "lexical_declaration" | "variable_declaration" => {
                extract_variable(file_id, &child, source, result, true)
            }
            "identifier" => {
                // export { foo }
                let name = node_text(&child, source).to_string();
                result.exports.push(ExportInfo {
                    name,
                    is_default,
                    line: node.start_position().row as i32 + 1,
                });
            }
            "export_clause" => {
                // export { foo, bar }
                let mut clause_cursor = child.walk();
                for spec in child.children(&mut clause_cursor) {
                    if spec.kind() == "export_specifier" {
                        if let Some(name_node) = find_child(&spec, "identifier") {
                            result.exports.push(ExportInfo {
                                name: node_text(&name_node, source).to_string(),
                                is_default: false,
                                line: spec.start_position().row as i32 + 1,
                            });
                        }
                    }
                }
            }
            _ => {}
        }
    }
}

fn extract_function(
    file_id: &str,
    node: &Node,
    source: &[u8],
    result: &mut ParseResult,
    is_exported: bool,
    parent_id: Option<String>,
) {
    let name_node = find_child(node, "identifier");
    let name = name_node
        .map(|n| node_text(&n, source))
        .unwrap_or("anonymous");

    // Build signature
    let params_node = find_child(node, "formal_parameters");
    let params = params_node
        .map(|n| node_text(&n, source).to_string())
        .unwrap_or_else(|| "()".to_string());

    let return_type = find_child(node, "type_annotation")
        .map(|n| node_text(&n, source).to_string());

    let signature = format!(
        "function {}{}{}",
        name,
        params,
        return_type.map(|t| format!("{}", t)).unwrap_or_default()
    );

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

fn extract_class(
    file_id: &str,
    node: &Node,
    source: &[u8],
    result: &mut ParseResult,
    is_exported: bool,
) {
    let name_node = find_child(node, "type_identifier")
        .or_else(|| find_child(node, "identifier"));
    let name = name_node
        .map(|n| node_text(&n, source))
        .unwrap_or("anonymous");

    // Check for extends
    let extends = if let Some(heritage) = find_child(node, "class_heritage") {
        if let Some(extends_clause) = find_child(&heritage, "extends_clause") {
            find_child(&extends_clause, "identifier")
                .map(|n| node_text(&n, source).to_string())
        } else {
            None
        }
    } else {
        None
    };

    let signature = if let Some(ext) = extends {
        format!("class {} extends {}", name, ext)
    } else {
        format!("class {}", name)
    };

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

    // Extract class body members
    if let Some(body) = find_child(node, "class_body") {
        let mut body_cursor = body.walk();
        for member in body.children(&mut body_cursor) {
            match member.kind() {
                "method_definition" | "public_field_definition" | "field_definition" => {
                    extract_class_member(file_id, &member, source, result, &class_id);
                }
                _ => {}
            }
        }
    }
}

fn extract_class_member(
    file_id: &str,
    node: &Node,
    source: &[u8],
    result: &mut ParseResult,
    parent_id: &str,
) {
    let name_node = find_child(node, "property_identifier")
        .or_else(|| find_child(node, "identifier"));
    let name = name_node
        .map(|n| node_text(&n, source))
        .unwrap_or("anonymous");

    let kind = if node.kind() == "method_definition" {
        "method"
    } else {
        "property"
    };

    result.symbols.push(create_symbol(
        file_id,
        name,
        kind,
        node,
        None,
        None,
        false,
        Some(parent_id.to_string()),
    ));
}

fn extract_interface(
    file_id: &str,
    node: &Node,
    source: &[u8],
    result: &mut ParseResult,
    is_exported: bool,
) {
    let name_node = find_child(node, "type_identifier")
        .or_else(|| find_child(node, "identifier"));
    let name = name_node
        .map(|n| node_text(&n, source))
        .unwrap_or("anonymous");

    let signature = format!("interface {}", name);

    result.symbols.push(create_symbol(
        file_id,
        name,
        "interface",
        node,
        Some(signature),
        None,
        is_exported,
        None,
    ));
}

fn extract_type_alias(
    file_id: &str,
    node: &Node,
    source: &[u8],
    result: &mut ParseResult,
    is_exported: bool,
) {
    let name_node = find_child(node, "type_identifier")
        .or_else(|| find_child(node, "identifier"));
    let name = name_node
        .map(|n| node_text(&n, source))
        .unwrap_or("anonymous");

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

fn extract_enum(
    file_id: &str,
    node: &Node,
    source: &[u8],
    result: &mut ParseResult,
    is_exported: bool,
) {
    let name_node = find_child(node, "identifier");
    let name = name_node
        .map(|n| node_text(&n, source))
        .unwrap_or("anonymous");

    result.symbols.push(create_symbol(
        file_id,
        name,
        "enum",
        node,
        Some(format!("enum {}", name)),
        None,
        is_exported,
        None,
    ));
}

fn extract_variable(
    file_id: &str,
    node: &Node,
    source: &[u8],
    result: &mut ParseResult,
    is_exported: bool,
) {
    // Find variable declarators
    let mut cursor = node.walk();
    for child in node.children(&mut cursor) {
        if child.kind() == "variable_declarator" {
            if let Some(name_node) = find_child(&child, "identifier") {
                let name = node_text(&name_node, source);

                // Check if it's an arrow function or function expression
                let value_node = find_child(&child, "arrow_function")
                    .or_else(|| find_child(&child, "function"));

                let kind = if value_node.is_some() {
                    "function"
                } else {
                    "variable"
                };

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
            function greet(name: string): string {
                return `Hello, ${name}!`;
            }
        "#;

        let result = parser.parse_file("test", SupportedLanguage::TypeScript, source).unwrap();
        assert_eq!(result.symbols.len(), 1);
        assert_eq!(result.symbols[0].name, "greet");
        assert_eq!(result.symbols[0].kind, "function");
    }

    #[test]
    fn test_extract_class() {
        let parser = Parser::new();
        let source = r#"
            class User {
                name: string;

                constructor(name: string) {
                    this.name = name;
                }

                greet(): string {
                    return `Hello, ${this.name}!`;
                }
            }
        "#;

        let result = parser.parse_file("test", SupportedLanguage::TypeScript, source).unwrap();
        // Should have class + constructor + greet method + name property
        assert!(result.symbols.len() >= 1);
        assert_eq!(result.symbols[0].name, "User");
        assert_eq!(result.symbols[0].kind, "class");
    }

    #[test]
    fn test_extract_imports() {
        let parser = Parser::new();
        let source = r#"
            import { foo, bar } from './utils';
            import React from 'react';
            import * as lodash from 'lodash';
        "#;

        let result = parser.parse_file("test", SupportedLanguage::TypeScript, source).unwrap();
        assert_eq!(result.imports.len(), 3);
        assert_eq!(result.imports[0].source, "./utils");
        assert_eq!(result.imports[1].source, "react");
        assert!(result.imports[1].is_default);
    }

    #[test]
    fn test_extract_exports() {
        let parser = Parser::new();
        let source = r#"
            export function foo() {}
            export const bar = 42;
            export default class Baz {}
        "#;

        let result = parser.parse_file("test", SupportedLanguage::TypeScript, source).unwrap();
        assert!(result.symbols.iter().any(|s| s.name == "foo" && s.is_exported));
        assert!(result.symbols.iter().any(|s| s.name == "bar" && s.is_exported));
        assert!(result.symbols.iter().any(|s| s.name == "Baz" && s.is_exported));
    }
}
