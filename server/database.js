import sqlite3 from 'sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class Database {
  constructor() {
    this.dbPath = join(__dirname, 'drawdb.sqlite');
    this.db = null;
  }

  async connect() {
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
  }

  async close() {
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

  async getDiagram(id) {
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

  async updateDiagram(id, title, databaseType, content) {
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

  async deleteDiagram(id) {
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

  async getRecentDiagrams(limit = 10) {
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
}

export default Database; 