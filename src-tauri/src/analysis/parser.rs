use std::collections::HashMap;
use std::sync::Mutex;
use tree_sitter::{Language, Tree};

use crate::error::{NexusError, NexusResult};
use crate::storage::SymbolRecord;

/// Supported languages for parsing
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum SupportedLanguage {
    TypeScript,
    JavaScript,
    Python,
    Go,
    Rust,
    C,
    Swift,
}

impl SupportedLanguage {
    pub fn from_extension(ext: &str) -> Option<Self> {
        match ext.to_lowercase().as_str() {
            "ts" | "tsx" => Some(Self::TypeScript),
            "js" | "jsx" | "mjs" | "cjs" => Some(Self::JavaScript),
            "py" | "pyw" => Some(Self::Python),
            "go" => Some(Self::Go),
            "rs" => Some(Self::Rust),
            "c" | "h" => Some(Self::C),
            // Swift disabled due to tree-sitter ABI version incompatibility
            // "swift" => Some(Self::Swift),
            _ => None,
        }
    }

    pub fn as_str(&self) -> &'static str {
        match self {
            Self::TypeScript => "typescript",
            Self::JavaScript => "javascript",
            Self::Python => "python",
            Self::Go => "go",
            Self::Rust => "rust",
            Self::C => "c",
            Self::Swift => "swift",
        }
    }

    fn tree_sitter_language(&self) -> Language {
        match self {
            Self::TypeScript => tree_sitter_typescript::LANGUAGE_TYPESCRIPT.into(),
            Self::JavaScript => tree_sitter_javascript::LANGUAGE.into(),
            Self::Python => tree_sitter_python::LANGUAGE.into(),
            Self::Go => tree_sitter_go::LANGUAGE.into(),
            Self::Rust => tree_sitter_rust::LANGUAGE.into(),
            Self::C => tree_sitter_c::LANGUAGE.into(),
            // Swift disabled - tree-sitter ABI version incompatibility
            Self::Swift => panic!("Swift parsing is currently disabled"),
        }
    }
}

/// Result of parsing a single file
#[derive(Debug, Default)]
pub struct ParseResult {
    pub symbols: Vec<SymbolRecord>,
    pub imports: Vec<ImportInfo>,
    pub exports: Vec<ExportInfo>,
}

/// Information about an import statement
#[derive(Debug, Clone)]
pub struct ImportInfo {
    pub source: String,
    pub imported_names: Vec<String>,
    pub is_default: bool,
    pub line: i32,
}

/// Information about an export
#[derive(Debug, Clone)]
pub struct ExportInfo {
    pub name: String,
    pub is_default: bool,
    pub line: i32,
}

/// Thread-safe parser that manages Tree-sitter parsers for different languages
pub struct Parser {
    parsers: Mutex<HashMap<SupportedLanguage, tree_sitter::Parser>>,
}

impl Parser {
    pub fn new() -> Self {
        Self {
            parsers: Mutex::new(HashMap::new()),
        }
    }

    /// Parse source code and return the AST
    #[tracing::instrument(skip(self, source))]
    pub fn parse(&self, language: SupportedLanguage, source: &str) -> NexusResult<Tree> {
        // Recover from poisoned lock - this can happen if a parsing thread panicked
        // It's safe to recover because we just cache parsers and can recreate them
        let mut parsers = self.parsers.lock().unwrap_or_else(|poisoned| {
            tracing::warn!("Parser lock was poisoned, recovering...");
            poisoned.into_inner()
        });

        // Get or create parser for this language
        let parser = parsers.entry(language).or_insert_with(|| {
            let mut p = tree_sitter::Parser::new();
            p.set_language(&language.tree_sitter_language()).expect("Language should be valid");
            p
        });

        parser
            .parse(source, None)
            .ok_or_else(|| NexusError::ParseError {
                file: String::new(),
                line: 0,
                message: "Failed to parse source".to_string(),
            })
    }

    /// Parse a file and extract symbols and relationships
    #[tracing::instrument(skip(self, source))]
    pub fn parse_file(
        &self,
        file_id: &str,
        language: SupportedLanguage,
        source: &str,
    ) -> NexusResult<ParseResult> {
        let tree = self.parse(language, source)?;
        let root = tree.root_node();

        let mut result = ParseResult::default();
        let source_bytes = source.as_bytes();

        // Use language-specific extractor
        match language {
            SupportedLanguage::TypeScript | SupportedLanguage::JavaScript => {
                super::extractors::typescript::extract(file_id, &root, source_bytes, &mut result);
            }
            SupportedLanguage::Python => {
                super::extractors::python::extract(file_id, &root, source_bytes, &mut result);
            }
            SupportedLanguage::Go => {
                super::extractors::go::extract(file_id, &root, source_bytes, &mut result);
            }
            SupportedLanguage::Rust => {
                super::extractors::rust::extract(file_id, &root, source_bytes, &mut result);
            }
            SupportedLanguage::C => {
                super::extractors::c::extract(file_id, &root, source_bytes, &mut result);
            }
            SupportedLanguage::Swift => {
                super::extractors::swift::extract(file_id, &root, source_bytes, &mut result);
            }
        }

        Ok(result)
    }
}

impl Default for Parser {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_language_from_extension() {
        assert_eq!(SupportedLanguage::from_extension("ts"), Some(SupportedLanguage::TypeScript));
        assert_eq!(SupportedLanguage::from_extension("tsx"), Some(SupportedLanguage::TypeScript));
        assert_eq!(SupportedLanguage::from_extension("js"), Some(SupportedLanguage::JavaScript));
        assert_eq!(SupportedLanguage::from_extension("py"), Some(SupportedLanguage::Python));
        assert_eq!(SupportedLanguage::from_extension("go"), Some(SupportedLanguage::Go));
        assert_eq!(SupportedLanguage::from_extension("rs"), Some(SupportedLanguage::Rust));
        assert_eq!(SupportedLanguage::from_extension("c"), Some(SupportedLanguage::C));
        assert_eq!(SupportedLanguage::from_extension("unknown"), None);
    }

    #[test]
    fn test_parse_typescript() {
        let parser = Parser::new();
        let source = r#"
            function hello(name: string): string {
                return `Hello, ${name}!`;
            }
        "#;

        let tree = parser.parse(SupportedLanguage::TypeScript, source).unwrap();
        assert!(tree.root_node().child_count() > 0);
    }

    #[test]
    fn test_parse_python() {
        let parser = Parser::new();
        let source = r#"
def hello(name: str) -> str:
    return f"Hello, {name}!"
        "#;

        let tree = parser.parse(SupportedLanguage::Python, source).unwrap();
        assert!(tree.root_node().child_count() > 0);
    }
}
