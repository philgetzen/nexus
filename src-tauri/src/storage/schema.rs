use rusqlite::Connection;
use crate::error::NexusResult;

/// Database schema version for migrations
const SCHEMA_VERSION: i32 = 1;

/// Run all database migrations
pub fn run_migrations(conn: &Connection) -> NexusResult<()> {
    let current_version = get_schema_version(conn)?;

    if current_version < SCHEMA_VERSION {
        tracing::info!("Running database migrations from v{} to v{}", current_version, SCHEMA_VERSION);

        // Migration 0 -> 1: Initial schema
        if current_version < 1 {
            migrate_v1(conn)?;
        }

        set_schema_version(conn, SCHEMA_VERSION)?;
    }

    Ok(())
}

fn get_schema_version(conn: &Connection) -> NexusResult<i32> {
    // Create schema_version table if not exists
    conn.execute(
        "CREATE TABLE IF NOT EXISTS schema_version (version INTEGER NOT NULL)",
        [],
    )?;

    let version: Option<i32> = conn
        .query_row("SELECT version FROM schema_version LIMIT 1", [], |row| row.get(0))
        .ok();

    Ok(version.unwrap_or(0))
}

fn set_schema_version(conn: &Connection, version: i32) -> NexusResult<()> {
    conn.execute("DELETE FROM schema_version", [])?;
    conn.execute("INSERT INTO schema_version (version) VALUES (?1)", [version])?;
    Ok(())
}

/// Initial database schema
fn migrate_v1(conn: &Connection) -> NexusResult<()> {
    tracing::debug!("Applying migration v1: Initial schema");

    // Projects table
    conn.execute(
        "CREATE TABLE IF NOT EXISTS projects (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            path TEXT NOT NULL UNIQUE,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            last_analyzed_at TEXT,
            is_favorite INTEGER NOT NULL DEFAULT 0
        )",
        [],
    )?;

    // Files table
    conn.execute(
        "CREATE TABLE IF NOT EXISTS files (
            id TEXT PRIMARY KEY,
            project_id TEXT NOT NULL,
            name TEXT NOT NULL,
            path TEXT NOT NULL,
            absolute_path TEXT NOT NULL,
            language TEXT NOT NULL,
            line_count INTEGER NOT NULL DEFAULT 0,
            is_hidden INTEGER NOT NULL DEFAULT 0,
            content_hash TEXT,
            last_modified TEXT,
            FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
            UNIQUE (project_id, path)
        )",
        [],
    )?;

    // Symbols table
    conn.execute(
        "CREATE TABLE IF NOT EXISTS symbols (
            id TEXT PRIMARY KEY,
            file_id TEXT NOT NULL,
            name TEXT NOT NULL,
            kind TEXT NOT NULL,
            line INTEGER NOT NULL,
            column INTEGER NOT NULL,
            end_line INTEGER,
            end_column INTEGER,
            signature TEXT,
            documentation TEXT,
            is_exported INTEGER NOT NULL DEFAULT 0,
            parent_id TEXT,
            FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE,
            FOREIGN KEY (parent_id) REFERENCES symbols(id) ON DELETE SET NULL
        )",
        [],
    )?;

    // Relationships table
    conn.execute(
        "CREATE TABLE IF NOT EXISTS relationships (
            id TEXT PRIMARY KEY,
            source_id TEXT NOT NULL,
            target_id TEXT NOT NULL,
            kind TEXT NOT NULL,
            metadata TEXT,
            UNIQUE (source_id, target_id, kind)
        )",
        [],
    )?;

    // Settings table
    conn.execute(
        "CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        )",
        [],
    )?;

    // Create indexes for performance
    conn.execute("CREATE INDEX IF NOT EXISTS idx_files_project ON files(project_id)", [])?;
    conn.execute("CREATE INDEX IF NOT EXISTS idx_files_language ON files(language)", [])?;
    conn.execute("CREATE INDEX IF NOT EXISTS idx_symbols_file ON symbols(file_id)", [])?;
    conn.execute("CREATE INDEX IF NOT EXISTS idx_symbols_kind ON symbols(kind)", [])?;
    conn.execute("CREATE INDEX IF NOT EXISTS idx_symbols_name ON symbols(name)", [])?;
    conn.execute("CREATE INDEX IF NOT EXISTS idx_relationships_source ON relationships(source_id)", [])?;
    conn.execute("CREATE INDEX IF NOT EXISTS idx_relationships_target ON relationships(target_id)", [])?;
    conn.execute("CREATE INDEX IF NOT EXISTS idx_relationships_kind ON relationships(kind)", [])?;

    tracing::debug!("Migration v1 complete");
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use rusqlite::Connection;

    #[test]
    fn test_migrations() {
        let conn = Connection::open_in_memory().unwrap();
        run_migrations(&conn).unwrap();

        let version = get_schema_version(&conn).unwrap();
        assert_eq!(version, SCHEMA_VERSION);
    }

    #[test]
    fn test_idempotent_migrations() {
        let conn = Connection::open_in_memory().unwrap();

        // Run migrations multiple times
        run_migrations(&conn).unwrap();
        run_migrations(&conn).unwrap();
        run_migrations(&conn).unwrap();

        let version = get_schema_version(&conn).unwrap();
        assert_eq!(version, SCHEMA_VERSION);
    }
}
