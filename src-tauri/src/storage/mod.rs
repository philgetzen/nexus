mod schema;
pub mod repository;

pub use schema::run_migrations;
pub use repository::{Repository, Project, FileRecord, SymbolRecord, RelationshipRecord};

use r2d2::{Pool, PooledConnection};
use r2d2_sqlite::SqliteConnectionManager;
use std::path::Path;

use crate::error::NexusResult;

/// Type alias for SQLite connection pool
pub type DbPool = Pool<SqliteConnectionManager>;
/// Type alias for pooled connection
pub type DbConnection = PooledConnection<SqliteConnectionManager>;

/// Initialize the database connection pool
pub fn init_pool(db_path: &Path) -> NexusResult<DbPool> {
    let manager = SqliteConnectionManager::file(db_path);
    let pool = Pool::builder()
        .max_size(10)
        .build(manager)?;

    // Run migrations on first connection
    {
        let conn = pool.get()?;
        run_migrations(&conn)?;
    }

    tracing::info!("Database initialized at {:?}", db_path);
    Ok(pool)
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn test_init_pool() {
        let dir = tempdir().unwrap();
        let db_path = dir.path().join("test.db");

        let pool = init_pool(&db_path).unwrap();
        assert!(pool.get().is_ok());
    }
}
