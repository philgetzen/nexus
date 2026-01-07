use std::path::PathBuf;
use tauri::State;

use crate::error::NexusResult;
use crate::storage::Project;
use crate::AppState;

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

#[cfg(test)]
mod tests {
    

    // Tests would require mocking the state
    // We rely on integration tests and repository tests instead
}
