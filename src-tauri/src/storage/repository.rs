use rusqlite::params;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use super::DbPool;
use crate::error::NexusResult;

/// Repository for database operations
#[derive(Clone)]
pub struct Repository {
    pool: DbPool,  // DbPool (r2d2::Pool) implements Clone
}

// ============================================================================
// Data Transfer Objects
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Project {
    pub id: String,
    pub name: String,
    pub path: String,
    pub created_at: String,
    pub last_analyzed_at: Option<String>,
    pub is_favorite: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileRecord {
    pub id: String,
    pub project_id: String,
    pub name: String,
    pub path: String,
    pub absolute_path: String,
    pub language: String,
    pub line_count: i32,
    pub is_hidden: bool,
    pub content_hash: Option<String>,
    pub last_modified: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SymbolRecord {
    pub id: String,
    pub file_id: String,
    pub name: String,
    pub kind: String,
    pub line: i32,
    pub column: i32,
    pub end_line: Option<i32>,
    pub end_column: Option<i32>,
    pub signature: Option<String>,
    pub documentation: Option<String>,
    pub is_exported: bool,
    pub parent_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RelationshipRecord {
    pub id: String,
    pub source_id: String,
    pub target_id: String,
    pub kind: String,
    pub metadata: Option<String>,
}

impl Repository {
    pub fn new(pool: DbPool) -> Self {
        Self { pool }
    }

    // ========================================================================
    // Project Operations
    // ========================================================================

    #[tracing::instrument(skip(self))]
    pub fn create_project(&self, name: &str, path: &str) -> NexusResult<Project> {
        let conn = self.pool.get()?;
        let id = Uuid::new_v4().to_string();
        let created_at = chrono_now();

        conn.execute(
            "INSERT INTO projects (id, name, path, created_at) VALUES (?1, ?2, ?3, ?4)",
            params![id, name, path, created_at],
        )?;

        Ok(Project {
            id,
            name: name.to_string(),
            path: path.to_string(),
            created_at,
            last_analyzed_at: None,
            is_favorite: false,
        })
    }

    #[tracing::instrument(skip(self))]
    pub fn get_project(&self, id: &str) -> NexusResult<Option<Project>> {
        let conn = self.pool.get()?;
        let mut stmt = conn.prepare(
            "SELECT id, name, path, created_at, last_analyzed_at, is_favorite FROM projects WHERE id = ?1",
        )?;

        let project = stmt.query_row([id], |row| {
            Ok(Project {
                id: row.get(0)?,
                name: row.get(1)?,
                path: row.get(2)?,
                created_at: row.get(3)?,
                last_analyzed_at: row.get(4)?,
                is_favorite: row.get::<_, i32>(5)? != 0,
            })
        }).ok();

        Ok(project)
    }

    #[tracing::instrument(skip(self))]
    pub fn get_project_by_path(&self, path: &str) -> NexusResult<Option<Project>> {
        let conn = self.pool.get()?;
        let mut stmt = conn.prepare(
            "SELECT id, name, path, created_at, last_analyzed_at, is_favorite FROM projects WHERE path = ?1",
        )?;

        let project = stmt.query_row([path], |row| {
            Ok(Project {
                id: row.get(0)?,
                name: row.get(1)?,
                path: row.get(2)?,
                created_at: row.get(3)?,
                last_analyzed_at: row.get(4)?,
                is_favorite: row.get::<_, i32>(5)? != 0,
            })
        }).ok();

        Ok(project)
    }

    #[tracing::instrument(skip(self))]
    pub fn list_projects(&self) -> NexusResult<Vec<Project>> {
        let conn = self.pool.get()?;
        let mut stmt = conn.prepare(
            "SELECT id, name, path, created_at, last_analyzed_at, is_favorite FROM projects ORDER BY created_at DESC",
        )?;

        let projects = stmt
            .query_map([], |row| {
                Ok(Project {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    path: row.get(2)?,
                    created_at: row.get(3)?,
                    last_analyzed_at: row.get(4)?,
                    is_favorite: row.get::<_, i32>(5)? != 0,
                })
            })?
            .filter_map(|r| r.ok())
            .collect();

        Ok(projects)
    }

    #[tracing::instrument(skip(self))]
    pub fn update_project_analyzed(&self, id: &str) -> NexusResult<()> {
        let conn = self.pool.get()?;
        conn.execute(
            "UPDATE projects SET last_analyzed_at = ?1 WHERE id = ?2",
            params![chrono_now(), id],
        )?;
        Ok(())
    }

    #[tracing::instrument(skip(self))]
    pub fn delete_project(&self, id: &str) -> NexusResult<()> {
        let conn = self.pool.get()?;
        conn.execute("DELETE FROM projects WHERE id = ?1", [id])?;
        Ok(())
    }

    // ========================================================================
    // File Operations
    // ========================================================================

    #[tracing::instrument(skip(self))]
    pub fn upsert_file(&self, file: &FileRecord) -> NexusResult<()> {
        let conn = self.pool.get()?;
        conn.execute(
            "INSERT INTO files (id, project_id, name, path, absolute_path, language, line_count, is_hidden, content_hash, last_modified)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
             ON CONFLICT(project_id, path) DO UPDATE SET
                name = excluded.name,
                absolute_path = excluded.absolute_path,
                language = excluded.language,
                line_count = excluded.line_count,
                is_hidden = excluded.is_hidden,
                content_hash = excluded.content_hash,
                last_modified = excluded.last_modified",
            params![
                file.id,
                file.project_id,
                file.name,
                file.path,
                file.absolute_path,
                file.language,
                file.line_count,
                file.is_hidden as i32,
                file.content_hash,
                file.last_modified,
            ],
        )?;
        Ok(())
    }

    #[tracing::instrument(skip(self))]
    pub fn get_files_for_project(&self, project_id: &str) -> NexusResult<Vec<FileRecord>> {
        let conn = self.pool.get()?;
        let mut stmt = conn.prepare(
            "SELECT id, project_id, name, path, absolute_path, language, line_count, is_hidden, content_hash, last_modified
             FROM files WHERE project_id = ?1 ORDER BY path",
        )?;

        let files = stmt
            .query_map([project_id], |row| {
                Ok(FileRecord {
                    id: row.get(0)?,
                    project_id: row.get(1)?,
                    name: row.get(2)?,
                    path: row.get(3)?,
                    absolute_path: row.get(4)?,
                    language: row.get(5)?,
                    line_count: row.get(6)?,
                    is_hidden: row.get::<_, i32>(7)? != 0,
                    content_hash: row.get(8)?,
                    last_modified: row.get(9)?,
                })
            })?
            .filter_map(|r| r.ok())
            .collect();

        Ok(files)
    }

    #[tracing::instrument(skip(self))]
    pub fn get_file(&self, id: &str) -> NexusResult<Option<FileRecord>> {
        let conn = self.pool.get()?;
        let mut stmt = conn.prepare(
            "SELECT id, project_id, name, path, absolute_path, language, line_count, is_hidden, content_hash, last_modified
             FROM files WHERE id = ?1",
        )?;

        let file = stmt
            .query_row([id], |row| {
                Ok(FileRecord {
                    id: row.get(0)?,
                    project_id: row.get(1)?,
                    name: row.get(2)?,
                    path: row.get(3)?,
                    absolute_path: row.get(4)?,
                    language: row.get(5)?,
                    line_count: row.get(6)?,
                    is_hidden: row.get::<_, i32>(7)? != 0,
                    content_hash: row.get(8)?,
                    last_modified: row.get(9)?,
                })
            })
            .ok();

        Ok(file)
    }

    #[tracing::instrument(skip(self))]
    pub fn delete_files_for_project(&self, project_id: &str) -> NexusResult<()> {
        let conn = self.pool.get()?;
        conn.execute("DELETE FROM files WHERE project_id = ?1", [project_id])?;
        Ok(())
    }

    /// Update the visibility of a file in the graph
    #[tracing::instrument(skip(self))]
    pub fn set_file_hidden(&self, file_id: &str, is_hidden: bool) -> NexusResult<bool> {
        let conn = self.pool.get()?;
        let rows_affected = conn.execute(
            "UPDATE files SET is_hidden = ?1 WHERE id = ?2",
            params![is_hidden as i32, file_id],
        )?;
        Ok(rows_affected > 0)
    }

    // ========================================================================
    // Symbol Operations
    // ========================================================================

    #[tracing::instrument(skip(self, symbols))]
    pub fn batch_insert_symbols(&self, symbols: &[SymbolRecord]) -> NexusResult<()> {
        let mut conn = self.pool.get()?;
        let tx = conn.transaction()?;

        {
            let mut stmt = tx.prepare(
                "INSERT INTO symbols (id, file_id, name, kind, line, column, end_line, end_column, signature, documentation, is_exported, parent_id)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)",
            )?;

            for symbol in symbols {
                stmt.execute(params![
                    symbol.id,
                    symbol.file_id,
                    symbol.name,
                    symbol.kind,
                    symbol.line,
                    symbol.column,
                    symbol.end_line,
                    symbol.end_column,
                    symbol.signature,
                    symbol.documentation,
                    symbol.is_exported as i32,
                    symbol.parent_id,
                ])?;
            }
        }

        tx.commit()?;
        Ok(())
    }

    #[tracing::instrument(skip(self))]
    pub fn get_symbols_for_file(&self, file_id: &str) -> NexusResult<Vec<SymbolRecord>> {
        let conn = self.pool.get()?;
        let mut stmt = conn.prepare(
            "SELECT id, file_id, name, kind, line, column, end_line, end_column, signature, documentation, is_exported, parent_id
             FROM symbols WHERE file_id = ?1 ORDER BY line",
        )?;

        let symbols = stmt
            .query_map([file_id], |row| {
                Ok(SymbolRecord {
                    id: row.get(0)?,
                    file_id: row.get(1)?,
                    name: row.get(2)?,
                    kind: row.get(3)?,
                    line: row.get(4)?,
                    column: row.get(5)?,
                    end_line: row.get(6)?,
                    end_column: row.get(7)?,
                    signature: row.get(8)?,
                    documentation: row.get(9)?,
                    is_exported: row.get::<_, i32>(10)? != 0,
                    parent_id: row.get(11)?,
                })
            })?
            .filter_map(|r| r.ok())
            .collect();

        Ok(symbols)
    }

    #[tracing::instrument(skip(self))]
    pub fn get_symbol(&self, id: &str) -> NexusResult<Option<SymbolRecord>> {
        let conn = self.pool.get()?;
        let mut stmt = conn.prepare(
            "SELECT id, file_id, name, kind, line, column, end_line, end_column, signature, documentation, is_exported, parent_id
             FROM symbols WHERE id = ?1",
        )?;

        let symbol = stmt
            .query_row([id], |row| {
                Ok(SymbolRecord {
                    id: row.get(0)?,
                    file_id: row.get(1)?,
                    name: row.get(2)?,
                    kind: row.get(3)?,
                    line: row.get(4)?,
                    column: row.get(5)?,
                    end_line: row.get(6)?,
                    end_column: row.get(7)?,
                    signature: row.get(8)?,
                    documentation: row.get(9)?,
                    is_exported: row.get::<_, i32>(10)? != 0,
                    parent_id: row.get(11)?,
                })
            })
            .ok();

        Ok(symbol)
    }

    #[tracing::instrument(skip(self))]
    pub fn delete_symbols_for_file(&self, file_id: &str) -> NexusResult<()> {
        let conn = self.pool.get()?;
        conn.execute("DELETE FROM symbols WHERE file_id = ?1", [file_id])?;
        Ok(())
    }

    // ========================================================================
    // Relationship Operations
    // ========================================================================

    #[tracing::instrument(skip(self, relationships))]
    pub fn batch_insert_relationships(&self, relationships: &[RelationshipRecord]) -> NexusResult<()> {
        let mut conn = self.pool.get()?;
        let tx = conn.transaction()?;

        {
            let mut stmt = tx.prepare(
                "INSERT OR IGNORE INTO relationships (id, source_id, target_id, kind, metadata)
                 VALUES (?1, ?2, ?3, ?4, ?5)",
            )?;

            for rel in relationships {
                stmt.execute(params![
                    rel.id,
                    rel.source_id,
                    rel.target_id,
                    rel.kind,
                    rel.metadata,
                ])?;
            }
        }

        tx.commit()?;
        Ok(())
    }

    #[tracing::instrument(skip(self))]
    pub fn get_relationships_for_project(&self, project_id: &str) -> NexusResult<Vec<RelationshipRecord>> {
        let conn = self.pool.get()?;
        let mut stmt = conn.prepare(
            "SELECT r.id, r.source_id, r.target_id, r.kind, r.metadata
             FROM relationships r
             INNER JOIN files f ON (r.source_id = f.id OR r.target_id = f.id)
             WHERE f.project_id = ?1
             GROUP BY r.id",
        )?;

        let relationships = stmt
            .query_map([project_id], |row| {
                Ok(RelationshipRecord {
                    id: row.get(0)?,
                    source_id: row.get(1)?,
                    target_id: row.get(2)?,
                    kind: row.get(3)?,
                    metadata: row.get(4)?,
                })
            })?
            .filter_map(|r| r.ok())
            .collect();

        Ok(relationships)
    }

    #[tracing::instrument(skip(self))]
    pub fn get_relationships_for_node(&self, node_id: &str) -> NexusResult<Vec<RelationshipRecord>> {
        let conn = self.pool.get()?;
        let mut stmt = conn.prepare(
            "SELECT id, source_id, target_id, kind, metadata
             FROM relationships
             WHERE source_id = ?1 OR target_id = ?1",
        )?;

        let relationships = stmt
            .query_map([node_id], |row| {
                Ok(RelationshipRecord {
                    id: row.get(0)?,
                    source_id: row.get(1)?,
                    target_id: row.get(2)?,
                    kind: row.get(3)?,
                    metadata: row.get(4)?,
                })
            })?
            .filter_map(|r| r.ok())
            .collect();

        Ok(relationships)
    }

    #[tracing::instrument(skip(self))]
    pub fn clear_project_data(&self, project_id: &str) -> NexusResult<()> {
        let conn = self.pool.get()?;

        // Delete relationships involving project files
        conn.execute(
            "DELETE FROM relationships WHERE source_id IN (SELECT id FROM files WHERE project_id = ?1)
             OR target_id IN (SELECT id FROM files WHERE project_id = ?1)",
            [project_id],
        )?;

        // Delete symbols (cascades from files)
        conn.execute(
            "DELETE FROM symbols WHERE file_id IN (SELECT id FROM files WHERE project_id = ?1)",
            [project_id],
        )?;

        // Delete files
        conn.execute("DELETE FROM files WHERE project_id = ?1", [project_id])?;

        Ok(())
    }

    // ========================================================================
    // Settings Operations
    // ========================================================================

    #[tracing::instrument(skip(self))]
    pub fn get_setting(&self, key: &str) -> NexusResult<Option<String>> {
        let conn = self.pool.get()?;
        let value = conn
            .query_row("SELECT value FROM settings WHERE key = ?1", [key], |row| row.get(0))
            .ok();
        Ok(value)
    }

    #[tracing::instrument(skip(self))]
    pub fn set_setting(&self, key: &str, value: &str) -> NexusResult<()> {
        let conn = self.pool.get()?;
        conn.execute(
            "INSERT INTO settings (key, value) VALUES (?1, ?2)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            params![key, value],
        )?;
        Ok(())
    }
}

/// Get current timestamp in ISO 8601 format (UTC)
fn chrono_now() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};

    let duration = SystemTime::now().duration_since(UNIX_EPOCH).unwrap();
    let secs = duration.as_secs();

    // Convert Unix timestamp to ISO 8601 format
    // Calculate date/time components from Unix timestamp
    let days_since_epoch = secs / 86400;
    let time_of_day = secs % 86400;

    let hours = time_of_day / 3600;
    let minutes = (time_of_day % 3600) / 60;
    let seconds = time_of_day % 60;

    // Calculate year, month, day from days since epoch (1970-01-01)
    let (year, month, day) = days_to_ymd(days_since_epoch as i64);

    format!("{:04}-{:02}-{:02}T{:02}:{:02}:{:02}Z", year, month, day, hours, minutes, seconds)
}

/// Convert days since Unix epoch to year/month/day
fn days_to_ymd(days: i64) -> (i32, u32, u32) {
    // Algorithm from Howard Hinnant
    let z = days + 719468;
    let era = if z >= 0 { z } else { z - 146096 } / 146097;
    let doe = (z - era * 146097) as u32;
    let yoe = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365;
    let y = yoe as i64 + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = doy - (153 * mp + 2) / 5 + 1;
    let m = if mp < 10 { mp + 3 } else { mp - 9 };
    let y = if m <= 2 { y + 1 } else { y };
    (y as i32, m, d)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::init_pool;
    use tempfile::{tempdir, TempDir};

    fn test_repo() -> (Repository, TempDir) {
        let dir = tempdir().unwrap();
        let db_path = dir.path().join("test.db");
        let pool = init_pool(&db_path).unwrap();
        (Repository::new(pool), dir)
    }

    #[test]
    fn test_create_and_get_project() {
        let (repo, _dir) = test_repo();

        let project = repo.create_project("Test Project", "/path/to/project").unwrap();
        assert!(!project.id.is_empty());
        assert_eq!(project.name, "Test Project");

        let fetched = repo.get_project(&project.id).unwrap().unwrap();
        assert_eq!(fetched.id, project.id);
        assert_eq!(fetched.name, project.name);
    }

    #[test]
    fn test_list_projects() {
        let (repo, _dir) = test_repo();

        repo.create_project("Project 1", "/path/1").unwrap();
        repo.create_project("Project 2", "/path/2").unwrap();

        let projects = repo.list_projects().unwrap();
        assert_eq!(projects.len(), 2);
    }

    #[test]
    fn test_upsert_file() {
        let (repo, _dir) = test_repo();
        let project = repo.create_project("Test", "/path").unwrap();

        let file = FileRecord {
            id: Uuid::new_v4().to_string(),
            project_id: project.id.clone(),
            name: "test.ts".to_string(),
            path: "src/test.ts".to_string(),
            absolute_path: "/path/src/test.ts".to_string(),
            language: "typescript".to_string(),
            line_count: 100,
            is_hidden: false,
            content_hash: None,
            last_modified: None,
        };

        repo.upsert_file(&file).unwrap();

        let files = repo.get_files_for_project(&project.id).unwrap();
        assert_eq!(files.len(), 1);
        assert_eq!(files[0].name, "test.ts");
    }

    #[test]
    fn test_settings() {
        let (repo, _dir) = test_repo();

        repo.set_setting("editor", "vscode").unwrap();
        let value = repo.get_setting("editor").unwrap();
        assert_eq!(value, Some("vscode".to_string()));

        // Update setting
        repo.set_setting("editor", "cursor").unwrap();
        let value = repo.get_setting("editor").unwrap();
        assert_eq!(value, Some("cursor".to_string()));
    }

    #[test]
    fn test_chrono_now_format() {
        let timestamp = super::chrono_now();
        // Should be in ISO 8601 format: YYYY-MM-DDTHH:MM:SSZ
        assert!(timestamp.len() == 20, "Timestamp should be 20 chars: {}", timestamp);
        assert!(timestamp.ends_with('Z'), "Timestamp should end with Z: {}", timestamp);
        assert!(timestamp.contains('T'), "Timestamp should contain T: {}", timestamp);

        // Verify format with regex-like check
        let parts: Vec<&str> = timestamp.split('T').collect();
        assert_eq!(parts.len(), 2);

        let date_parts: Vec<&str> = parts[0].split('-').collect();
        assert_eq!(date_parts.len(), 3);
        assert_eq!(date_parts[0].len(), 4); // YYYY
        assert_eq!(date_parts[1].len(), 2); // MM
        assert_eq!(date_parts[2].len(), 2); // DD
    }

    #[test]
    fn test_get_file() {
        let (repo, _dir) = test_repo();
        let project = repo.create_project("Test", "/path").unwrap();

        let file = FileRecord {
            id: "file-123".to_string(),
            project_id: project.id.clone(),
            name: "test.ts".to_string(),
            path: "src/test.ts".to_string(),
            absolute_path: "/path/src/test.ts".to_string(),
            language: "typescript".to_string(),
            line_count: 100,
            is_hidden: false,
            content_hash: None,
            last_modified: None,
        };

        repo.upsert_file(&file).unwrap();

        // Test get_file
        let fetched = repo.get_file("file-123").unwrap();
        assert!(fetched.is_some());
        let fetched = fetched.unwrap();
        assert_eq!(fetched.id, "file-123");
        assert_eq!(fetched.name, "test.ts");
        assert_eq!(fetched.language, "typescript");

        // Test non-existent file
        let not_found = repo.get_file("non-existent").unwrap();
        assert!(not_found.is_none());
    }

    #[test]
    fn test_get_symbol() {
        let (repo, _dir) = test_repo();
        let project = repo.create_project("Test", "/path").unwrap();

        let file = FileRecord {
            id: "file-456".to_string(),
            project_id: project.id.clone(),
            name: "test.ts".to_string(),
            path: "src/test.ts".to_string(),
            absolute_path: "/path/src/test.ts".to_string(),
            language: "typescript".to_string(),
            line_count: 100,
            is_hidden: false,
            content_hash: None,
            last_modified: None,
        };
        repo.upsert_file(&file).unwrap();

        let symbols = vec![
            SymbolRecord {
                id: "symbol-123".to_string(),
                file_id: "file-456".to_string(),
                name: "myFunction".to_string(),
                kind: "function".to_string(),
                line: 10,
                column: 1,
                end_line: Some(20),
                end_column: Some(1),
                signature: Some("function myFunction(): void".to_string()),
                documentation: Some("A test function".to_string()),
                is_exported: true,
                parent_id: None,
            },
        ];
        repo.batch_insert_symbols(&symbols).unwrap();

        // Test get_symbol
        let fetched = repo.get_symbol("symbol-123").unwrap();
        assert!(fetched.is_some());
        let fetched = fetched.unwrap();
        assert_eq!(fetched.id, "symbol-123");
        assert_eq!(fetched.name, "myFunction");
        assert_eq!(fetched.kind, "function");
        assert!(fetched.is_exported);

        // Test non-existent symbol
        let not_found = repo.get_symbol("non-existent").unwrap();
        assert!(not_found.is_none());
    }

    #[test]
    fn test_get_relationships_for_node() {
        let (repo, _dir) = test_repo();
        let project = repo.create_project("Test", "/path").unwrap();

        // Create two files
        let file1 = FileRecord {
            id: "file-a".to_string(),
            project_id: project.id.clone(),
            name: "a.ts".to_string(),
            path: "src/a.ts".to_string(),
            absolute_path: "/path/src/a.ts".to_string(),
            language: "typescript".to_string(),
            line_count: 50,
            is_hidden: false,
            content_hash: None,
            last_modified: None,
        };
        let file2 = FileRecord {
            id: "file-b".to_string(),
            project_id: project.id.clone(),
            name: "b.ts".to_string(),
            path: "src/b.ts".to_string(),
            absolute_path: "/path/src/b.ts".to_string(),
            language: "typescript".to_string(),
            line_count: 30,
            is_hidden: false,
            content_hash: None,
            last_modified: None,
        };
        repo.upsert_file(&file1).unwrap();
        repo.upsert_file(&file2).unwrap();

        // Create relationships: a imports b, b imports a
        let relationships = vec![
            RelationshipRecord {
                id: "rel-1".to_string(),
                source_id: "file-a".to_string(),
                target_id: "file-b".to_string(),
                kind: "imports".to_string(),
                metadata: None,
            },
            RelationshipRecord {
                id: "rel-2".to_string(),
                source_id: "file-b".to_string(),
                target_id: "file-a".to_string(),
                kind: "imports".to_string(),
                metadata: None,
            },
        ];
        repo.batch_insert_relationships(&relationships).unwrap();

        // Test get_relationships_for_node for file-a
        let rels_a = repo.get_relationships_for_node("file-a").unwrap();
        assert_eq!(rels_a.len(), 2); // One outgoing, one incoming

        // Verify relationships
        let outgoing: Vec<_> = rels_a.iter().filter(|r| r.source_id == "file-a").collect();
        let incoming: Vec<_> = rels_a.iter().filter(|r| r.target_id == "file-a").collect();
        assert_eq!(outgoing.len(), 1);
        assert_eq!(incoming.len(), 1);

        // Test get_relationships_for_node for non-existent node
        let rels_none = repo.get_relationships_for_node("non-existent").unwrap();
        assert!(rels_none.is_empty());
    }

    #[test]
    fn test_set_file_hidden() {
        let (repo, _dir) = test_repo();

        // Create a project
        let project = repo.create_project("Test", "/path/to/project").unwrap();

        // Create a file
        let file = FileRecord {
            id: "file-1".to_string(),
            project_id: project.id.clone(),
            name: "test.ts".to_string(),
            path: "src/test.ts".to_string(),
            absolute_path: "/path/src/test.ts".to_string(),
            language: "typescript".to_string(),
            line_count: 100,
            is_hidden: false,
            content_hash: None,
            last_modified: None,
        };
        repo.upsert_file(&file).unwrap();

        // Verify file is not hidden initially
        let retrieved = repo.get_file("file-1").unwrap().unwrap();
        assert!(!retrieved.is_hidden);

        // Hide the file
        let result = repo.set_file_hidden("file-1", true).unwrap();
        assert!(result);

        // Verify file is now hidden
        let retrieved = repo.get_file("file-1").unwrap().unwrap();
        assert!(retrieved.is_hidden);

        // Unhide the file
        let result = repo.set_file_hidden("file-1", false).unwrap();
        assert!(result);

        // Verify file is not hidden anymore
        let retrieved = repo.get_file("file-1").unwrap().unwrap();
        assert!(!retrieved.is_hidden);

        // Try to hide non-existent file
        let result = repo.set_file_hidden("non-existent", true).unwrap();
        assert!(!result);
    }
}
