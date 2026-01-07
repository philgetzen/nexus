use serde::Serialize;
use thiserror::Error;

/// Result type alias for Nexus operations
pub type NexusResult<T> = Result<T, NexusError>;

/// Application-level errors for Nexus
#[derive(Debug, Error, Serialize)]
#[serde(tag = "type", content = "data")]
pub enum NexusError {
    #[error("Project not found: {path}")]
    ProjectNotFound { path: String },

    #[error("Parse error in {file} at line {line}: {message}")]
    ParseError {
        file: String,
        line: u32,
        message: String,
    },

    #[error("Database error: {0}")]
    Database(String),

    #[error("File system error: {0}")]
    FileSystem(String),

    #[error("Analysis cancelled")]
    AnalysisCancelled,

    #[error("Invalid ignore pattern: {0}")]
    InvalidPattern(String),

    #[error("Internal error: {0}")]
    Internal(String),
}

// Implement From traits for common error types
impl From<std::io::Error> for NexusError {
    fn from(e: std::io::Error) -> Self {
        NexusError::FileSystem(e.to_string())
    }
}

impl From<serde_json::Error> for NexusError {
    fn from(e: serde_json::Error) -> Self {
        NexusError::Internal(format!("JSON error: {}", e))
    }
}

impl From<rusqlite::Error> for NexusError {
    fn from(e: rusqlite::Error) -> Self {
        NexusError::Database(e.to_string())
    }
}

impl From<r2d2::Error> for NexusError {
    fn from(e: r2d2::Error) -> Self {
        NexusError::Database(format!("Connection pool error: {}", e))
    }
}

impl From<walkdir::Error> for NexusError {
    fn from(e: walkdir::Error) -> Self {
        NexusError::FileSystem(e.to_string())
    }
}

impl From<ignore::Error> for NexusError {
    fn from(e: ignore::Error) -> Self {
        NexusError::InvalidPattern(e.to_string())
    }
}
