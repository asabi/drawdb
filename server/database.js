import sqlite3 from 'sqlite3';
import mysql from 'mysql2/promise';
import pkg from 'pg';
const { Client } = pkg;
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import connectionManager from './db/connection.js';
import SchemaManager from './db/schema.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class Database {
  constructor() {
    this.dbPath = join(__dirname, 'drawdb.sqlite');
    this.db = null;
    this.schemaManager = new SchemaManager(connectionManager);
  }

  async connect() {
    // If no custom connection is configured, use default SQLite
    if (!connectionManager.isConnected()) {
      return new Promise((resolve, reject) => {
        this.db = new sqlite3.Database(this.dbPath, (err) => {
          if (err) {
            console.error('Error opening database:', err.message);
            reject(err);
          } else {
            console.log('Connected to SQLite database');
            resolve();
          }
        });
      });
    } else {
      console.log('Using configured database connection');
      return Promise.resolve();
    }
  }

  async close() {
    if (connectionManager.isConnected()) {
      await connectionManager.disconnect();
      console.log('Database connection closed');
      return;
    }

    return new Promise((resolve, reject) => {
      if (!this.db) {
        resolve();
        return;
      }
      this.db.close((err) => {
        if (err) {
          console.error('Error closing database:', err.message);
          reject(err);
        } else {
          console.log('Database connection closed');
          resolve();
        }
      });
    });
  }

  async createDiagram(id, title, databaseType, content) {
    if (connectionManager.isConnected()) {
      return await this.createDiagramWithConnection(id, title, databaseType, content);
    }

    if (!this.db) {
      throw new Error('Database not connected');
    }

    return new Promise((resolve, reject) => {
      const stmt = this.db.prepare(`
        INSERT INTO diagrams (id, title, database_type, content, created_at, updated_at)
        VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `);
      
      stmt.run([id, title, databaseType, JSON.stringify(content)], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ id, title, databaseType, content });
        }
      });
      
      stmt.finalize();
    });
  }

  async createDiagramWithConnection(id, title, databaseType, content) {
    const connection = connectionManager.getConnection();
    const config = connectionManager.getConfig();
    
    try {
      switch (config.engine) {
        case 'sqlite':
          return await this.createDiagramSQLite(connection, id, title, databaseType, content);
        
        case 'mysql':
          return await this.createDiagramMySQL(connection, id, title, databaseType, content);
        
        case 'postgresql':
          return await this.createDiagramPostgres(connection, id, title, databaseType, content);
        
        default:
          throw new Error(`Unsupported database engine: ${config.engine}`);
      }
    } catch (error) {
      throw error;
    }
  }

  async createDiagramSQLite(connection, id, title, databaseType, content) {
    return new Promise((resolve, reject) => {
      const stmt = connection.prepare(`
        INSERT INTO diagrams (id, title, database_type, content, created_at, updated_at)
        VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `);
      
      stmt.run([id, title, databaseType, JSON.stringify(content)], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ id, title, databaseType, content });
        }
      });
      
      stmt.finalize();
    });
  }

  async createDiagramMySQL(connection, id, title, databaseType, content) {
    const [result] = await connection.execute(
      `INSERT INTO diagrams (id, title, database_type, content, created_at, updated_at)
       VALUES (?, ?, ?, ?, NOW(), NOW())`,
      [id, title, databaseType, JSON.stringify(content)]
    );
    
    return { id, title, databaseType, content };
  }

  async createDiagramPostgres(connection, id, title, databaseType, content) {
    await connection.query(
      `INSERT INTO diagrams (id, title, database_type, content, created_at, updated_at)
       VALUES ($1, $2, $3, $4, NOW(), NOW())`,
      [id, title, databaseType, JSON.stringify(content)]
    );
    
    return { id, title, databaseType, content };
  }

  async getDiagram(id) {
    if (connectionManager.isConnected()) {
      return await this.getDiagramWithConnection(id);
    }

    if (!this.db) {
      throw new Error('Database not connected');
    }

    return new Promise((resolve, reject) => {
      const stmt = this.db.prepare('SELECT * FROM diagrams WHERE id = ?');
      
      stmt.get([id], (err, row) => {
        if (err) {
          reject(err);
        } else if (!row) {
          reject(new Error('Diagram not found'));
        } else {
          resolve({
            id: row.id,
            title: row.title,
            databaseType: row.database_type,
            content: JSON.parse(row.content),
            createdAt: row.created_at,
            updatedAt: row.updated_at
          });
        }
      });
      
      stmt.finalize();
    });
  }

  async getDiagramWithConnection(id) {
    const connection = connectionManager.getConnection();
    const config = connectionManager.getConfig();
    
    try {
      switch (config.engine) {
        case 'sqlite':
          return await this.getDiagramSQLite(connection, id);
        
        case 'mysql':
          return await this.getDiagramMySQL(connection, id);
        
        case 'postgresql':
          return await this.getDiagramPostgres(connection, id);
        
        default:
          throw new Error(`Unsupported database engine: ${config.engine}`);
      }
    } catch (error) {
      throw error;
    }
  }

  async getDiagramSQLite(connection, id) {
    return new Promise((resolve, reject) => {
      const stmt = connection.prepare('SELECT * FROM diagrams WHERE id = ?');
      
      stmt.get([id], (err, row) => {
        if (err) {
          reject(err);
        } else if (!row) {
          reject(new Error('Diagram not found'));
        } else {
          resolve({
            id: row.id,
            title: row.title,
            databaseType: row.database_type,
            content: JSON.parse(row.content),
            createdAt: row.created_at,
            updatedAt: row.updated_at
          });
        }
      });
      
      stmt.finalize();
    });
  }

  async getDiagramMySQL(connection, id) {
    const [rows] = await connection.execute(
      'SELECT * FROM diagrams WHERE id = ?',
      [id]
    );
    
    if (rows.length === 0) {
      throw new Error('Diagram not found');
    }
    
    const row = rows[0];
    return {
      id: row.id,
      title: row.title,
      databaseType: row.database_type,
      content: JSON.parse(row.content),
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  async getDiagramPostgres(connection, id) {
    const result = await connection.query(
      'SELECT * FROM diagrams WHERE id = $1',
      [id]
    );
    
    if (result.rows.length === 0) {
      throw new Error('Diagram not found');
    }
    
    const row = result.rows[0];
    return {
      id: row.id,
      title: row.title,
      databaseType: row.database_type,
      content: JSON.parse(row.content),
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  async updateDiagram(id, title, databaseType, content) {
    if (connectionManager.isConnected()) {
      return await this.updateDiagramWithConnection(id, title, databaseType, content);
    }

    if (!this.db) {
      throw new Error('Database not connected');
    }

    return new Promise((resolve, reject) => {
      const stmt = this.db.prepare(`
        UPDATE diagrams 
        SET title = ?, database_type = ?, content = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `);
      
      stmt.run([title, databaseType, JSON.stringify(content), id], function(err) {
        if (err) {
          reject(err);
        } else if (this.changes === 0) {
          reject(new Error('Diagram not found'));
        } else {
          resolve({ id, title, databaseType, content });
        }
      });
      
      stmt.finalize();
    });
  }

  async updateDiagramWithConnection(id, title, databaseType, content) {
    const connection = connectionManager.getConnection();
    const config = connectionManager.getConfig();
    
    try {
      switch (config.engine) {
        case 'sqlite':
          return await this.updateDiagramSQLite(connection, id, title, databaseType, content);
        
        case 'mysql':
          return await this.updateDiagramMySQL(connection, id, title, databaseType, content);
        
        case 'postgresql':
          return await this.updateDiagramPostgres(connection, id, title, databaseType, content);
        
        default:
          throw new Error(`Unsupported database engine: ${config.engine}`);
      }
    } catch (error) {
      throw error;
    }
  }

  async updateDiagramSQLite(connection, id, title, databaseType, content) {
    return new Promise((resolve, reject) => {
      const stmt = connection.prepare(`
        UPDATE diagrams 
        SET title = ?, database_type = ?, content = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `);
      
      stmt.run([title, databaseType, JSON.stringify(content), id], function(err) {
        if (err) {
          reject(err);
        } else if (this.changes === 0) {
          reject(new Error('Diagram not found'));
        } else {
          resolve({ id, title, databaseType, content });
        }
      });
      
      stmt.finalize();
    });
  }

  async updateDiagramMySQL(connection, id, title, databaseType, content) {
    const [result] = await connection.execute(
      `UPDATE diagrams 
       SET title = ?, database_type = ?, content = ?, updated_at = NOW()
       WHERE id = ?`,
      [title, databaseType, JSON.stringify(content), id]
    );
    
    if (result.affectedRows === 0) {
      throw new Error('Diagram not found');
    }
    
    return { id, title, databaseType, content };
  }

  async updateDiagramPostgres(connection, id, title, databaseType, content) {
    const result = await connection.query(
      `UPDATE diagrams 
       SET title = $1, database_type = $2, content = $3, updated_at = NOW()
       WHERE id = $4`,
      [title, databaseType, JSON.stringify(content), id]
    );
    
    if (result.rowCount === 0) {
      throw new Error('Diagram not found');
    }
    
    return { id, title, databaseType, content };
  }

  async deleteDiagram(id) {
    if (connectionManager.isConnected()) {
      return await this.deleteDiagramWithConnection(id);
    }

    if (!this.db) {
      throw new Error('Database not connected');
    }

    return new Promise((resolve, reject) => {
      const stmt = this.db.prepare('DELETE FROM diagrams WHERE id = ?');
      
      stmt.run([id], function(err) {
        if (err) {
          reject(err);
        } else if (this.changes === 0) {
          reject(new Error('Diagram not found'));
        } else {
          resolve({ id });
        }
      });
      
      stmt.finalize();
    });
  }

  async deleteDiagramWithConnection(id) {
    const connection = connectionManager.getConnection();
    const config = connectionManager.getConfig();
    
    try {
      switch (config.engine) {
        case 'sqlite':
          return await this.deleteDiagramSQLite(connection, id);
        
        case 'mysql':
          return await this.deleteDiagramMySQL(connection, id);
        
        case 'postgresql':
          return await this.deleteDiagramPostgres(connection, id);
        
        default:
          throw new Error(`Unsupported database engine: ${config.engine}`);
      }
    } catch (error) {
      throw error;
    }
  }

  async deleteDiagramSQLite(connection, id) {
    return new Promise((resolve, reject) => {
      const stmt = connection.prepare('DELETE FROM diagrams WHERE id = ?');
      
      stmt.run([id], function(err) {
        if (err) {
          reject(err);
        } else if (this.changes === 0) {
          reject(new Error('Diagram not found'));
        } else {
          resolve({ id });
        }
      });
      
      stmt.finalize();
    });
  }

  async deleteDiagramMySQL(connection, id) {
    const [result] = await connection.execute(
      'DELETE FROM diagrams WHERE id = ?',
      [id]
    );
    
    if (result.affectedRows === 0) {
      throw new Error('Diagram not found');
    }
    
    return { id };
  }

  async deleteDiagramPostgres(connection, id) {
    const result = await connection.query(
      'DELETE FROM diagrams WHERE id = $1',
      [id]
    );
    
    if (result.rowCount === 0) {
      throw new Error('Diagram not found');
    }
    
    return { id };
  }

  async getRecentDiagrams(limit = 10) {
    if (connectionManager.isConnected()) {
      return await this.getRecentDiagramsWithConnection(limit);
    }

    if (!this.db) {
      throw new Error('Database not connected');
    }

    return new Promise((resolve, reject) => {
      const stmt = this.db.prepare(`
        SELECT id, title, database_type, updated_at 
        FROM diagrams 
        ORDER BY updated_at DESC 
        LIMIT ?
      `);
      
      stmt.all([limit], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows.map(row => ({
            id: row.id,
            title: row.title,
            databaseType: row.database_type,
            updatedAt: row.updated_at
          })));
        }
      });
      
      stmt.finalize();
    });
  }

  async getRecentDiagramsWithConnection(limit = 10) {
    const connection = connectionManager.getConnection();
    const config = connectionManager.getConfig();
    
    try {
      switch (config.engine) {
        case 'sqlite':
          return await this.getRecentDiagramsSQLite(connection, limit);
        
        case 'mysql':
          return await this.getRecentDiagramsMySQL(connection, limit);
        
        case 'postgresql':
          return await this.getRecentDiagramsPostgres(connection, limit);
        
        default:
          throw new Error(`Unsupported database engine: ${config.engine}`);
      }
    } catch (error) {
      throw error;
    }
  }

  async getRecentDiagramsSQLite(connection, limit) {
    return new Promise((resolve, reject) => {
      const stmt = connection.prepare(`
        SELECT id, title, database_type, updated_at 
        FROM diagrams 
        ORDER BY updated_at DESC 
        LIMIT ?
      `);
      
      stmt.all([limit], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows.map(row => ({
            id: row.id,
            title: row.title,
            databaseType: row.database_type,
            updatedAt: row.updated_at
          })));
        }
      });
      
      stmt.finalize();
    });
  }

  async getRecentDiagramsMySQL(connection, limit) {
    const [rows] = await connection.query(
      `SELECT id, title, database_type, updated_at 
       FROM diagrams 
       ORDER BY updated_at DESC 
       LIMIT ${parseInt(limit)}`
    );
    
    return rows.map(row => ({
      id: row.id,
      title: row.title,
      databaseType: row.database_type,
      updatedAt: row.updated_at
    }));
  }

  async getRecentDiagramsPostgres(connection, limit) {
    const result = await connection.query(
      `SELECT id, title, database_type, updated_at 
       FROM diagrams 
       ORDER BY updated_at DESC 
       LIMIT $1`,
      [limit]
    );
    
    return result.rows.map(row => ({
      id: row.id,
      title: row.title,
      databaseType: row.database_type,
      updatedAt: row.updated_at
    }));
  }
}

export default Database; 