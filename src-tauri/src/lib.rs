pub mod analysis;
pub mod commands;
pub mod error;
pub mod graph;
pub mod storage;

use std::collections::HashMap;
use std::sync::{Arc, Mutex};

use tauri::Manager;

use crate::analysis::AnalysisEngine;
use crate::storage::{init_pool, Repository};

// Re-export for convenience
pub use error::NexusResult;

/// Application state shared across all commands
pub struct AppState {
    pub repository: Repository,
    /// Map of project_id -> engine for cancellation support
    /// Wrapped in Arc so it can be cloned into spawned tasks
    pub analysis_engines: Arc<Mutex<HashMap<String, Arc<AnalysisEngine>>>>,
}

impl AppState {
    pub fn new(repository: Repository) -> Self {
        Self {
            repository,
            analysis_engines: Arc::new(Mutex::new(HashMap::new())),
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            // Get app data directory
            let app_dir = app.path().app_data_dir()?;
            std::fs::create_dir_all(&app_dir)?;

            // Initialize database
            let db_path = app_dir.join("nexus.db");
            tracing::info!("Database path: {:?}", db_path);

            let pool = init_pool(&db_path)?;
            let repository = Repository::new(pool);

            // Create and manage app state
            let state = AppState::new(repository);
            app.manage(state);

            // Open devtools in debug mode
            #[cfg(debug_assertions)]
            {
                if let Some(window) = app.get_webview_window("main") {
                    window.open_devtools();
                }
            }

            tracing::info!("Nexus setup complete");
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::greet,
            commands::get_app_info,
            commands::open_project,
            commands::list_projects,
            commands::get_project,
            commands::delete_project,
            commands::list_project_files,
            commands::start_analysis,
            commands::cancel_analysis,
            commands::get_graph_data,
            commands::get_node_details,
            commands::set_file_visibility,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn test_app_state_creation() {
        let dir = tempdir().unwrap();
        let db_path = dir.path().join("test.db");
        let pool = init_pool(&db_path).unwrap();
        let repository = Repository::new(pool);
        let state = AppState::new(repository);

        // Verify we can access the repository
        let projects = state.repository.list_projects().unwrap();
        assert!(projects.is_empty());
    }
}
