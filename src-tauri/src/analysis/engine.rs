use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

use ignore::WalkBuilder;
use rayon::prelude::*;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use super::parser::{Parser, SupportedLanguage};
use crate::error::{NexusError, NexusResult};
use crate::storage::{FileRecord, RelationshipRecord, SymbolRecord};

/// Analysis status - aligned with frontend types
#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum AnalysisStatus {
    #[default]
    Idle,
    Analyzing,
    Complete,
    Error,
    Cancelled,
}

/// Statistics from the analysis - aligned with frontend types
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct AnalysisStatistics {
    /// Total relationships found
    pub total_relationships: usize,
    /// Total symbols found
    pub total_symbols: usize,
    /// Total files analyzed
    pub total_files: usize,
}

/// Progress update for analysis - aligned with frontend types
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct AnalysisProgress {
    /// Current analysis state
    pub status: AnalysisStatus,
    /// File currently being analyzed
    pub current_file: Option<String>,
    /// Number of files processed
    pub files_processed: usize,
    /// Total files to process
    pub total_files: usize,
    /// Percentage complete (0-100)
    pub percent_complete: f64,
    /// Error message if status is Error
    pub error_message: Option<String>,
    /// Analysis statistics
    pub statistics: AnalysisStatistics,
}

impl AnalysisProgress {
    pub fn idle() -> Self {
        Self::default()
    }

    pub fn started(total_files: usize) -> Self {
        Self {
            status: AnalysisStatus::Analyzing,
            total_files,
            ..Default::default()
        }
    }

    pub fn parsing(current_file: &str, files_processed: usize, total_files: usize) -> Self {
        let percent = if total_files > 0 {
            (files_processed as f64 / total_files as f64) * 100.0
        } else {
            0.0
        };
        Self {
            status: AnalysisStatus::Analyzing,
            current_file: Some(current_file.to_string()),
            files_processed,
            total_files,
            percent_complete: percent,
            ..Default::default()
        }
    }

    pub fn completed(files: usize, symbols: usize, relationships: usize) -> Self {
        Self {
            status: AnalysisStatus::Complete,
            files_processed: files,
            total_files: files,
            percent_complete: 100.0,
            statistics: AnalysisStatistics {
                total_files: files,
                total_symbols: symbols,
                total_relationships: relationships,
            },
            ..Default::default()
        }
    }

    pub fn error(message: &str) -> Self {
        Self {
            status: AnalysisStatus::Error,
            error_message: Some(message.to_string()),
            ..Default::default()
        }
    }

    pub fn cancelled() -> Self {
        Self {
            status: AnalysisStatus::Cancelled,
            ..Default::default()
        }
    }
}

/// Result of analysis
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnalysisResult {
    pub files: Vec<FileRecord>,
    pub symbols: Vec<SymbolRecord>,
    pub relationships: Vec<RelationshipRecord>,
}

/// Main analysis engine
pub struct AnalysisEngine {
    parser: Parser,
    cancelled: Arc<AtomicBool>,
}

impl AnalysisEngine {
    pub fn new() -> Self {
        Self {
            parser: Parser::new(),
            cancelled: Arc::new(AtomicBool::new(false)),
        }
    }

    /// Cancel the current analysis
    pub fn cancel(&self) {
        self.cancelled.store(true, Ordering::SeqCst);
    }

    /// Check if analysis was cancelled
    fn is_cancelled(&self) -> bool {
        self.cancelled.load(Ordering::SeqCst)
    }

    /// Analyze a project directory
    #[tracing::instrument(skip(self, progress_callback))]
    pub fn analyze<F>(
        &self,
        project_id: &str,
        project_path: &Path,
        progress_callback: F,
    ) -> NexusResult<AnalysisResult>
    where
        F: Fn(AnalysisProgress) + Send + Sync,
    {
        // Reset cancellation flag
        self.cancelled.store(false, Ordering::SeqCst);

        // Discover files
        let files = self.discover_files(project_path, &progress_callback)?;

        if self.is_cancelled() {
            return Err(NexusError::AnalysisCancelled);
        }

        let total = files.len();
        progress_callback(AnalysisProgress::started(total));

        // Parse files in parallel
        let parsed_results: Vec<_> = files
            .par_iter()
            .enumerate()
            .filter_map(|(idx, file_path)| {
                if self.is_cancelled() {
                    return None;
                }

                let path_str = file_path.display().to_string();
                progress_callback(AnalysisProgress::parsing(&path_str, idx + 1, total));

                // Wrap parsing in catch_unwind to prevent panics from poisoning the parser lock
                let parse_result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
                    self.parse_file(project_id, project_path, file_path)
                }));

                match parse_result {
                    Ok(Ok(result)) => Some(result),
                    Ok(Err(e)) => {
                        tracing::warn!("Failed to parse {}: {}", path_str, e);
                        None
                    }
                    Err(_) => {
                        tracing::error!("Parser panicked while parsing {}", path_str);
                        None
                    }
                }
            })
            .collect();

        if self.is_cancelled() {
            progress_callback(AnalysisProgress::cancelled());
            return Err(NexusError::AnalysisCancelled);
        }

        // Collect all files and symbols
        let mut all_files = Vec::new();
        let mut all_symbols = Vec::new();
        let mut file_imports: HashMap<String, Vec<super::parser::ImportInfo>> = HashMap::new();

        for (file, symbols, imports) in parsed_results {
            file_imports.insert(file.id.clone(), imports);
            all_files.push(file);
            all_symbols.extend(symbols);
        }

        // Resolve relationships (report progress at 90%)
        progress_callback(AnalysisProgress {
            status: AnalysisStatus::Analyzing,
            current_file: Some("Resolving relationships...".to_string()),
            files_processed: all_files.len(),
            total_files: total,
            percent_complete: 90.0,
            ..Default::default()
        });

        // Resolve relationships
        let relationships = self.resolve_relationships(&all_files, &all_symbols, &file_imports)?;

        // Note: Don't send "complete" here - the command will send it AFTER storing to DB
        // to avoid race condition where frontend fetches data before it's stored

        Ok(AnalysisResult {
            files: all_files,
            symbols: all_symbols,
            relationships,
        })
    }

    /// Discover all source files in a directory
    fn discover_files<F>(&self, path: &Path, progress_callback: &F) -> NexusResult<Vec<PathBuf>>
    where
        F: Fn(AnalysisProgress),
    {
        let mut files = Vec::new();

        let walker = WalkBuilder::new(path)
            .hidden(false)
            .git_ignore(true)
            .git_global(true)
            .git_exclude(true)
            .ignore(true)
            .build();

        for entry in walker {
            let entry = entry?;
            let entry_path = entry.path();

            if !entry_path.is_file() {
                continue;
            }

            // Check if it's a supported file type
            let ext = entry_path.extension().and_then(|e| e.to_str()).unwrap_or("");
            if SupportedLanguage::from_extension(ext).is_some() {
                // Discovery phase - report idle status with file being discovered
                progress_callback(AnalysisProgress {
                    status: AnalysisStatus::Analyzing,
                    current_file: Some(entry_path.display().to_string()),
                    ..Default::default()
                });
                files.push(entry_path.to_path_buf());
            }
        }

        Ok(files)
    }

    /// Parse a single file
    fn parse_file(
        &self,
        project_id: &str,
        project_path: &Path,
        file_path: &Path,
    ) -> NexusResult<(FileRecord, Vec<SymbolRecord>, Vec<super::parser::ImportInfo>)> {
        let ext = file_path.extension().and_then(|e| e.to_str()).unwrap_or("");
        let language = SupportedLanguage::from_extension(ext)
            .ok_or_else(|| NexusError::ParseError {
                file: file_path.display().to_string(),
                line: 0,
                message: "Unsupported file type".to_string(),
            })?;

        let source = fs::read_to_string(file_path)?;
        let line_count = source.lines().count() as i32;

        let file_id = Uuid::new_v4().to_string();
        let file_name = file_path.file_name().and_then(|n| n.to_str()).unwrap_or("");
        let relative_path = file_path
            .strip_prefix(project_path)
            .unwrap_or(file_path)
            .to_string_lossy()
            .to_string();

        // Parse file
        let parse_result = self.parser.parse_file(&file_id, language, &source)?;

        let file = FileRecord {
            id: file_id,
            project_id: project_id.to_string(),
            name: file_name.to_string(),
            path: relative_path,
            absolute_path: file_path.to_string_lossy().to_string(),
            language: language.as_str().to_string(),
            line_count,
            is_hidden: false,
            content_hash: Some(calculate_hash(&source)),
            last_modified: None,
        };

        Ok((file, parse_result.symbols, parse_result.imports))
    }

    /// Resolve relationships between files and symbols
    fn resolve_relationships(
        &self,
        files: &[FileRecord],
        _symbols: &[SymbolRecord],
        file_imports: &HashMap<String, Vec<super::parser::ImportInfo>>,
    ) -> NexusResult<Vec<RelationshipRecord>> {
        let mut relationships = Vec::new();

        // Build a map of file paths to file IDs
        let path_to_id: HashMap<&str, &str> = files
            .iter()
            .map(|f| (f.path.as_str(), f.id.as_str()))
            .collect();

        // Also map file names for simpler resolution
        let name_to_id: HashMap<&str, &str> = files
            .iter()
            .map(|f| (f.name.as_str(), f.id.as_str()))
            .collect();

        for file in files {
            if let Some(imports) = file_imports.get(&file.id) {
                for import in imports {
                    // Try to resolve the import to a file
                    let resolved = resolve_import(&import.source, &file.path, &path_to_id, &name_to_id);

                    if let Some(target_id) = resolved {
                        relationships.push(RelationshipRecord {
                            id: Uuid::new_v4().to_string(),
                            source_id: file.id.clone(),
                            target_id: target_id.to_string(),
                            kind: "imports".to_string(),
                            metadata: None,
                        });
                    }
                }
            }
        }

        Ok(relationships)
    }
}

impl Default for AnalysisEngine {
    fn default() -> Self {
        Self::new()
    }
}

/// Calculate a simple hash of content
fn calculate_hash(content: &str) -> String {
    use std::collections::hash_map::DefaultHasher;
    use std::hash::{Hash, Hasher};

    let mut hasher = DefaultHasher::new();
    content.hash(&mut hasher);
    format!("{:x}", hasher.finish())
}

/// Resolve an import path to a file ID
fn resolve_import<'a>(
    import_source: &str,
    current_path: &str,
    path_to_id: &HashMap<&str, &'a str>,
    name_to_id: &HashMap<&str, &'a str>,
) -> Option<&'a str> {
    // Handle relative imports
    if import_source.starts_with('.') {
        let current_dir = Path::new(current_path).parent()?;
        let import_path = current_dir.join(import_source);

        // Try with common extensions
        for ext in &["", ".ts", ".tsx", ".js", ".jsx", ".py", ".go", ".rs", ".c", ".h"] {
            let path_with_ext = if ext.is_empty() {
                import_path.to_string_lossy().to_string()
            } else {
                format!("{}{}", import_path.to_string_lossy(), ext)
            };

            if let Some(&id) = path_to_id.get(path_with_ext.as_str()) {
                return Some(id);
            }
        }

        // Try index files
        for index in &["index.ts", "index.tsx", "index.js", "index.jsx"] {
            let index_path = import_path.join(index);
            if let Some(&id) = path_to_id.get(index_path.to_string_lossy().as_ref()) {
                return Some(id);
            }
        }
    }

    // Try direct file name match
    let file_name = Path::new(import_source)
        .file_name()
        .and_then(|n| n.to_str())?;

    for ext in &["", ".ts", ".tsx", ".js", ".jsx", ".py", ".go", ".rs", ".c", ".h"] {
        let name_with_ext = if ext.is_empty() {
            file_name.to_string()
        } else {
            format!("{}{}", file_name, ext)
        };

        if let Some(&id) = name_to_id.get(name_with_ext.as_str()) {
            return Some(id);
        }
    }

    None
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn test_discover_files() {
        let dir = tempdir().unwrap();

        // Create test files
        fs::write(dir.path().join("test.ts"), "const x = 1;").unwrap();
        fs::write(dir.path().join("test.py"), "x = 1").unwrap();
        fs::write(dir.path().join("readme.md"), "# Readme").unwrap();

        let engine = AnalysisEngine::new();
        let files = engine.discover_files(dir.path(), &|_| {}).unwrap();

        // Should find .ts and .py but not .md
        assert_eq!(files.len(), 2);
    }

    #[test]
    fn test_parse_typescript_file() {
        let dir = tempdir().unwrap();
        let file_path = dir.path().join("test.ts");

        fs::write(&file_path, r#"
            export function greet(name: string): string {
                return `Hello, ${name}!`;
            }
        "#).unwrap();

        let engine = AnalysisEngine::new();
        let (file, symbols, _) = engine.parse_file("project-1", dir.path(), &file_path).unwrap();

        assert_eq!(file.language, "typescript");
        assert!(symbols.iter().any(|s| s.name == "greet"));
    }

    #[test]
    fn test_calculate_hash() {
        let hash1 = calculate_hash("hello world");
        let hash2 = calculate_hash("hello world");
        let hash3 = calculate_hash("different");

        assert_eq!(hash1, hash2);
        assert_ne!(hash1, hash3);
    }
}
