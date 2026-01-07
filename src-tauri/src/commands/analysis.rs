use std::path::PathBuf;
use std::sync::Arc;
use tauri::{ipc::Channel, State};

use crate::analysis::{AnalysisEngine, AnalysisProgress};
use crate::error::{NexusError, NexusResult};
use crate::AppState;

/// Start analyzing a project
/// Analysis runs in a background thread and returns immediately.
/// Progress updates are sent via the channel.
#[tauri::command]
#[tracing::instrument(skip(state, channel))]
pub async fn start_analysis(
    project_id: String,
    channel: Channel<AnalysisProgress>,
    state: State<'_, AppState>,
) -> NexusResult<()> {
    // Quick validation - get project path
    let project = state
        .repository
        .get_project(&project_id)?
        .ok_or_else(|| NexusError::ProjectNotFound {
            path: project_id.clone(),
        })?;

    let project_path = PathBuf::from(&project.path);

    if !project_path.exists() {
        return Err(NexusError::ProjectNotFound {
            path: project.path.clone(),
        });
    }

    tracing::info!("Starting analysis for project: {}", project_id);

    // Clone repository for the spawned task (Repository now implements Clone)
    let repository = state.repository.clone();
    let pid = project_id.clone();

    // Clear existing project data synchronously (fast operation)
    repository.clear_project_data(&project_id)?;

    // Create analysis engine
    let engine = Arc::new(AnalysisEngine::new());
    let engine_clone = engine.clone();

    // Store engine for potential cancellation
    {
        let mut engines = state.analysis_engines.lock().unwrap();
        engines.insert(project_id.clone(), engine_clone);
    }

    // Clone engine map reference for cleanup in spawned task
    let engines_map = state.analysis_engines.clone();

    // Spawn analysis on a blocking thread - returns immediately
    tokio::task::spawn_blocking(move || {
        // Run analysis
        let result = engine.analyze(&pid, &project_path, |progress| {
            let _ = channel.send(progress);
        });

        // Remove engine from map
        {
            let mut engines = engines_map.lock().unwrap();
            engines.remove(&pid);
        }

        match result {
            Ok(analysis_result) => {
                // Store results in database
                for file in &analysis_result.files {
                    if let Err(e) = repository.upsert_file(file) {
                        tracing::error!("Failed to upsert file: {}", e);
                    }
                }

                if !analysis_result.symbols.is_empty() {
                    if let Err(e) = repository.batch_insert_symbols(&analysis_result.symbols) {
                        tracing::error!("Failed to insert symbols: {}", e);
                    }
                }

                if !analysis_result.relationships.is_empty() {
                    if let Err(e) = repository.batch_insert_relationships(&analysis_result.relationships) {
                        tracing::error!("Failed to insert relationships: {}", e);
                    }
                }

                // Update project last analyzed time
                if let Err(e) = repository.update_project_analyzed(&pid) {
                    tracing::error!("Failed to update project analyzed time: {}", e);
                }

                tracing::info!(
                    "Analysis complete: {} files, {} symbols, {} relationships",
                    analysis_result.files.len(),
                    analysis_result.symbols.len(),
                    analysis_result.relationships.len()
                );

                // Send "complete" status AFTER all DB writes are done
                // This ensures frontend won't fetch stale data
                let _ = channel.send(AnalysisProgress::completed(
                    analysis_result.files.len(),
                    analysis_result.symbols.len(),
                    analysis_result.relationships.len(),
                ));
            }
            Err(e) => {
                tracing::error!("Analysis failed: {}", e);
                let _ = channel.send(AnalysisProgress::error(&e.to_string()));
            }
        }
    });

    // Return immediately - analysis runs in background
    Ok(())
}

/// Cancel an ongoing analysis
#[tauri::command]
#[tracing::instrument(skip(state))]
pub async fn cancel_analysis(project_id: String, state: State<'_, AppState>) -> NexusResult<()> {
    tracing::info!("Cancelling analysis for project: {}", project_id);

    let engines = state.analysis_engines.lock().unwrap();
    if let Some(engine) = engines.get(&project_id) {
        engine.cancel();
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    // Integration tests would be needed for these commands
}
