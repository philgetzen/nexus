use std::path::{Path, PathBuf};
use ignore::WalkBuilder;
use serde::Serialize;
use tauri::State;

use crate::error::NexusResult;
use crate::storage::Project;
use crate::AppState;

/// File type classification for non-code files
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum FileType {
    Code,
    Image,
    Font,
    Config,
    Document,
    Other,
}

/// A project file entry for the sidebar (includes ALL files, not just code)
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectFile {
    pub id: String,
    pub name: String,
    pub path: String,
    pub absolute_path: String,
    pub file_type: FileType,
    pub size: u64,
}

impl ProjectFile {
    /// Create a ProjectFile from a file path
    pub fn from_path(file_path: &Path, project_root: &Path) -> Option<Self> {
        let name = file_path.file_name()?.to_string_lossy().to_string();
        let relative_path = file_path.strip_prefix(project_root).ok()?;
        let absolute_path = file_path.to_string_lossy().to_string();
        let size = std::fs::metadata(file_path).ok().map(|m| m.len()).unwrap_or(0);
        let file_type = determine_file_type(file_path);

        Some(Self {
            id: uuid::Uuid::new_v4().to_string(),
            name,
            path: relative_path.to_string_lossy().to_string(),
            absolute_path,
            file_type,
            size,
        })
    }
}

/// Determine the file type based on extension
fn determine_file_type(path: &Path) -> FileType {
    let ext = path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();

    match ext.as_str() {
        // Code files
        "ts" | "tsx" | "js" | "jsx" | "mjs" | "cjs" | "py" | "pyw" | "go" | "rs" | "c" | "h"
        | "cpp" | "hpp" | "swift" | "kt" | "java" | "rb" | "php" | "cs" | "vb" | "lua" | "pl"
        | "r" | "scala" | "clj" | "ex" | "exs" | "hs" | "ml" | "fs" | "dart" | "vue" | "svelte" => {
            FileType::Code
        }

        // Images
        "png" | "jpg" | "jpeg" | "gif" | "webp" | "svg" | "ico" | "bmp" | "tiff" | "heic"
        | "heif" | "raw" | "psd" | "ai" | "eps" => FileType::Image,

        // Fonts
        "woff" | "woff2" | "ttf" | "otf" | "eot" => FileType::Font,

        // Config files
        "json" | "yaml" | "yml" | "toml" | "xml" | "ini" | "cfg" | "conf" | "env" | "plist"
        | "properties" | "gradle" | "editorconfig" | "prettierrc" | "eslintrc" | "babelrc" => {
            FileType::Config
        }

        // Documents
        "md" | "markdown" | "txt" | "rst" | "adoc" | "org" | "tex" | "pdf" | "doc" | "docx"
        | "rtf" | "html" | "htm" | "css" | "scss" | "sass" | "less" => FileType::Document,

        // Shell scripts
        "sh" | "bash" | "zsh" | "fish" | "ps1" | "bat" | "cmd" => FileType::Code,

        // Everything else
        _ => FileType::Other,
    }
}

/// Open a project directory
#[tauri::command]
#[tracing::instrument(skip(state))]
pub async fn open_project(path: PathBuf, state: State<'_, AppState>) -> NexusResult<Project> {
    let path_str = path.to_string_lossy().to_string();
    let name = path
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("Unknown")
        .to_string();

    tracing::info!("Opening project: {}", path_str);

    // Check if project exists
    let existing = state.repository.get_project_by_path(&path_str)?;

    if let Some(project) = existing {
        tracing::info!("Found existing project: {}", project.id);
        Ok(project)
    } else {
        // Create new project
        let project = state.repository.create_project(&name, &path_str)?;
        tracing::info!("Created new project: {}", project.id);
        Ok(project)
    }
}

/// List all projects
#[tauri::command]
#[tracing::instrument(skip(state))]
pub async fn list_projects(state: State<'_, AppState>) -> NexusResult<Vec<Project>> {
    state.repository.list_projects()
}

/// Get a specific project by ID
#[tauri::command]
#[tracing::instrument(skip(state))]
pub async fn get_project(id: String, state: State<'_, AppState>) -> NexusResult<Option<Project>> {
    state.repository.get_project(&id)
}

/// Delete a project
#[tauri::command]
#[tracing::instrument(skip(state))]
pub async fn delete_project(id: String, state: State<'_, AppState>) -> NexusResult<()> {
    tracing::info!("Deleting project: {}", id);
    state.repository.delete_project(&id)
}

/// List ALL files in a project directory (not just code files)
/// This is used for the sidebar file browser
#[tauri::command]
#[tracing::instrument(skip(state))]
pub async fn list_project_files(
    project_id: String,
    state: State<'_, AppState>,
) -> NexusResult<Vec<ProjectFile>> {
    let project = state
        .repository
        .get_project(&project_id)?
        .ok_or_else(|| crate::error::NexusError::ProjectNotFound {
            path: project_id.clone(),
        })?;

    let project_path = PathBuf::from(&project.path);
    if !project_path.exists() {
        return Err(crate::error::NexusError::ProjectNotFound {
            path: project.path,
        });
    }

    tracing::info!("Listing all files for project: {}", project_id);

    let files = discover_all_files(&project_path)?;
    tracing::info!("Found {} files in project", files.len());

    Ok(files)
}

/// Discover ALL files in a directory, respecting .gitignore
fn discover_all_files(path: &Path) -> NexusResult<Vec<ProjectFile>> {
    let walker = WalkBuilder::new(path)
        .hidden(false) // Include hidden files
        .git_ignore(true) // Respect .gitignore
        .git_global(true) // Respect global gitignore
        .git_exclude(true) // Respect .git/info/exclude
        .ignore(true) // Respect .ignore files
        .build();

    let mut files = Vec::new();

    for entry in walker.flatten() {
        let entry_path = entry.path();

        // Skip directories
        if !entry_path.is_file() {
            continue;
        }

        if let Some(project_file) = ProjectFile::from_path(entry_path, path) {
            files.push(project_file);
        }
    }

    // Sort by path for consistent ordering
    files.sort_by(|a, b| a.path.cmp(&b.path));

    Ok(files)
}

#[cfg(test)]
mod tests {


    // Tests would require mocking the state
    // We rely on integration tests and repository tests instead
}
