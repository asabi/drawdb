import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class SchemaManager {
  constructor(connectionManager) {
    this.connectionManager = connectionManager;
  }

  // Ensure database and schema exist
  async ensureDatabaseAndSchema() {
    const config = this.connectionManager.getConfig();
    if (!config) {
      throw new Error('No database configuration found');
    }

    switch (config.engine) {
      case 'sqlite':
        return await this.ensureSQLiteSchema();
      
      case 'mysql':
        return await this.ensureMySQLDatabaseAndSchema();
      
      case 'postgresql':
        return await this.ensurePostgresDatabaseAndSchema();
      
      default:
        throw new Error(`Unsupported database engine: ${config.engine}`);
    }
  }

  async ensureSQLiteSchema() {
    const connection = this.connectionManager.getConnection();
    if (!connection) {
      throw new Error('No SQLite connection available');
    }

    return new Promise((resolve, reject) => {
      const createTableSQL = `
        CREATE TABLE IF NOT EXISTS diagrams (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          database_type TEXT NOT NULL,
          content TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `;

      connection.run(createTableSQL, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve({ success: true, message: 'SQLite schema ensured' });
        }
      });
    });
  }

  async ensureMySQLDatabaseAndSchema() {
    const connection = this.connectionManager.getConnection();
    if (!connection) {
      throw new Error('No MySQL connection available');
    }

    const config = this.connectionManager.getConfig();
    
    try {
      // Create database if it doesn't exist
      await connection.execute(`CREATE DATABASE IF NOT EXISTS \`${config.database}\``);
      
      // Use the database
      await connection.execute(`USE \`${config.database}\``);
      
      // Create tables
      const createTableSQL = `
        CREATE TABLE IF NOT EXISTS diagrams (
          id VARCHAR(255) PRIMARY KEY,
          title VARCHAR(255) NOT NULL,
          database_type VARCHAR(50) NOT NULL,
          content LONGTEXT NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
      `;

      await connection.execute(createTableSQL);
      
      return { success: true, message: 'MySQL database and schema ensured' };
    } catch (error) {
      throw error;
    }
  }

  async ensurePostgresDatabaseAndSchema() {
    const connection = this.connectionManager.getConnection();
    if (!connection) {
      throw new Error('No PostgreSQL connection available');
    }

    const config = this.connectionManager.getConfig();
    
    try {
      // Create database if it doesn't exist
      await connection.query(`CREATE DATABASE "${config.database}"`);
      
      // Create tables
      const createTableSQL = `
        CREATE TABLE IF NOT EXISTS diagrams (
          id VARCHAR(255) PRIMARY KEY,
          title VARCHAR(255) NOT NULL,
          database_type VARCHAR(50) NOT NULL,
          content TEXT NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `;

      await connection.query(createTableSQL);
      
      return { success: true, message: 'PostgreSQL database and schema ensured' };
    } catch (error) {
      // If database already exists, just ensure tables
      if (error.code === '42P04') { // duplicate_database
        const createTableSQL = `
          CREATE TABLE IF NOT EXISTS diagrams (
            id VARCHAR(255) PRIMARY KEY,
            title VARCHAR(255) NOT NULL,
            database_type VARCHAR(50) NOT NULL,
            content TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )
        `;

        await connection.query(createTableSQL);
        return { success: true, message: 'PostgreSQL schema ensured' };
      }
      throw error;
    }
  }
}

export default SchemaManager; 