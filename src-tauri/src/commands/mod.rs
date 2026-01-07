mod project;
mod analysis;
mod graph;

pub use project::*;
pub use analysis::*;
pub use graph::*;

use serde::Serialize;

/// Simple greeting command for testing IPC
#[tauri::command]
pub fn greet(name: &str) -> String {
    format!("Hello, {}! Welcome to Nexus.", name)
}

#[derive(Serialize)]
pub struct AppInfo {
    pub name: String,
    pub version: String,
}

/// Get application info
#[tauri::command]
pub fn get_app_info() -> AppInfo {
    AppInfo {
        name: "Nexus".to_string(),
        version: env!("CARGO_PKG_VERSION").to_string(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_greet() {
        let result = greet("World");
        assert_eq!(result, "Hello, World! Welcome to Nexus.");
    }

    #[test]
    fn test_app_info() {
        let info = get_app_info();
        assert_eq!(info.name, "Nexus");
        assert!(!info.version.is_empty());
    }
}
