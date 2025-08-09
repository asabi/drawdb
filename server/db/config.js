import sqlite3 from 'sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class ConfigManager {
  constructor() {
    this.db = null;
    this.configPath = join(__dirname, '..', 'config.sqlite');
  }

  // Initialize the configuration database
  async init() {
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(this.configPath, (err) => {
        if (err) {
          reject(err);
          return;
        }

        // Create the configurations table
        this.db.run(`
          CREATE TABLE IF NOT EXISTS database_configs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            engine TEXT NOT NULL,
            name TEXT NOT NULL,
            host TEXT,
            port INTEGER,
            username TEXT,
            password TEXT,
            database TEXT,
            filePath TEXT,
            useSSL BOOLEAN DEFAULT FALSE,
            useSSH BOOLEAN DEFAULT FALSE,
            sshHost TEXT,
            sshPort INTEGER DEFAULT 22,
            sshUser TEXT,
            privateKey TEXT,
            passphrase TEXT,
            ca TEXT,
            cert TEXT,
            key TEXT,
            configured BOOLEAN DEFAULT FALSE,
            is_default BOOLEAN DEFAULT FALSE,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `, (err) => {
          if (err) {
            reject(err);
            return;
          }

          // Ensure defaults, clean duplicates and normalize bad field mixes
          this.ensureDefaultConfig()
            .then(() => this.cleanupDuplicates())
            .then(() => this.normalizeExistingRows())
            .then(resolve)
            .catch(reject);
        });
      });
    });
  }

  // Ensure a baseline SQLite configuration exists once
  async ensureDefaultConfig() {
    return new Promise((resolve, reject) => {
      // If ANY sqlite config exists, do nothing (avoid duplicating on every boot)
      this.db.get(
        "SELECT id FROM database_configs WHERE engine = 'sqlite' LIMIT 1",
        (err, row) => {
          if (err) {
            reject(err);
            return;
          }

          if (!row) {
            const defaultSQLitePath = join(__dirname, '..', 'drawdb.sqlite');
            this.db.run(
              `INSERT INTO database_configs (
                engine, name, filePath, configured, is_default
              ) VALUES (?, ?, ?, ?, ?)`,
              // Do not force this as default to avoid flipping user's default engine
              ['sqlite', 'SQLite (Default)', defaultSQLitePath, true, 0],
              (insertErr) => {
                if (insertErr) {
                  reject(insertErr);
                } else {
                  resolve();
                }
              }
            );
          } else {
            resolve();
          }
        }
      );
    });
  }

  // Remove duplicate rows keeping the oldest per (engine,name)
  async cleanupDuplicates() {
    return new Promise((resolve, reject) => {
      const sql = `DELETE FROM database_configs
                   WHERE id NOT IN (
                     SELECT MIN(id) FROM database_configs GROUP BY engine, name
                   )`;
      this.db.run(sql, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  // Normalize any mixed/corrupted engine-specific fields at rest
  // - Non-sqlite engines must NOT have filePath
  // - Sqlite engine should NOT carry host/port/username/password/database/SSL/SSH fields
  async normalizeExistingRows() {
    return new Promise((resolve, reject) => {
      this.db.serialize(() => {
        // Remove stray filePath from non-sqlite configs
        this.db.run(
          "UPDATE database_configs SET filePath = NULL WHERE engine != 'sqlite' AND filePath IS NOT NULL",
          (e1) => {
            if (e1) return reject(e1);
            // Clear network-only fields for sqlite configs
            this.db.run(
              "UPDATE database_configs SET host=NULL, port=NULL, username=NULL, password=NULL, database=NULL, useSSL=0, useSSH=0, sshHost=NULL, sshPort=NULL, sshUser=NULL, privateKey=NULL, passphrase=NULL, ca=NULL, cert=NULL, key=NULL WHERE engine = 'sqlite'",
              (e2) => {
                if (e2) return reject(e2);
                resolve();
              }
            );
          }
        );
      });
    });
  }

  // Encrypt sensitive data
  encrypt(text, key = process.env.ENCRYPTION_KEY || 'default-key-change-in-production') {
    if (!text) return '';
    const algorithm = 'aes-256-cbc';
    const iv = crypto.randomBytes(16);
    const keyHash = crypto.createHash('sha256').update(key).digest();
    const cipher = crypto.createCipheriv(algorithm, keyHash, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
  }

  // Decrypt sensitive data
  decrypt(encryptedText, key = process.env.ENCRYPTION_KEY || 'default-key-change-in-production') {
    if (!encryptedText) return '';
    try {
      const algorithm = 'aes-256-cbc';
      const keyHash = crypto.createHash('sha256').update(key).digest();
      const parts = encryptedText.split(':');
      if (parts.length !== 2) {
        // Handle old format without IV (backward compatibility)
        console.warn('Encrypted data in old format, returning as-is');
        return encryptedText;
      }
      const iv = Buffer.from(parts[0], 'hex');
      const encryptedData = parts[1];
      const decipher = crypto.createDecipheriv(algorithm, keyHash, iv);
      let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } catch (error) {
      console.warn('Failed to decrypt value, returning as-is:', error.message);
      return encryptedText;
    }
  }

  // Save a database configuration
  async saveConfig(config) {
    return new Promise((resolve, reject) => {
      // Sanitize engine-specific fields before persisting
      const cleaned = this.sanitizeForEngine(config);
      const {
        engine, name, host, port, username, password, database, filePath,
        useSSL, useSSH, sshHost, sshPort, sshUser, privateKey, passphrase,
        ca, cert, key, configured = true, is_default = false
      } = cleaned;

      // Encrypt sensitive fields
      const encryptedPassword = this.encrypt(password);
      const encryptedPrivateKey = this.encrypt(privateKey);
      const encryptedPassphrase = this.encrypt(passphrase);
      const encryptedCA = this.encrypt(ca);
      const encryptedCert = this.encrypt(cert);
      const encryptedKey = this.encrypt(key);

      // Check if configuration already exists
      this.db.get(
        "SELECT id FROM database_configs WHERE engine = ? AND name = ?",
        [engine, name],
        (err, row) => {
          if (err) {
            reject(err);
            return;
          }

          if (row) {
            // Update existing configuration
            this.db.run(`
              UPDATE database_configs SET
                host = ?, port = ?, username = ?, password = ?, database = ?, filePath = ?,
                useSSL = ?, useSSH = ?, sshHost = ?, sshPort = ?, sshUser = ?, 
                privateKey = ?, passphrase = ?, ca = ?, cert = ?, key = ?,
                configured = ?, is_default = ?, updated_at = CURRENT_TIMESTAMP
              WHERE id = ?
            `, [
              host, port, username, encryptedPassword, database, filePath,
              useSSL, useSSH, sshHost, sshPort, sshUser,
              encryptedPrivateKey, encryptedPassphrase, encryptedCA, encryptedCert, encryptedKey,
              configured, is_default, row.id
            ], (err) => {
              if (err) {
                reject(err);
              } else {
                resolve(row.id);
              }
            });
          } else {
            // Insert new configuration
            this.db.run(`
              INSERT INTO database_configs (
                engine, name, host, port, username, password, database, filePath,
                useSSL, useSSH, sshHost, sshPort, sshUser, privateKey, passphrase,
                ca, cert, key, configured, is_default
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
              engine, name, host, port, username, encryptedPassword, database, filePath,
              useSSL, useSSH, sshHost, sshPort, sshUser,
              encryptedPrivateKey, encryptedPassphrase, encryptedCA, encryptedCert, encryptedKey,
              configured, is_default
            ], function(err) {
              if (err) {
                reject(err);
              } else {
                resolve(this.lastID);
              }
            });
          }
        }
      );
    });
  }

  // Get all database configurations
  async getAllConfigs() {
    return new Promise((resolve, reject) => {
      this.db.all("SELECT * FROM database_configs ORDER BY is_default DESC, name ASC", (err, rows) => {
        if (err) {
          reject(err);
          return;
        }

        // Decrypt sensitive fields
        const configs = rows.map(row => {
          const cfg = {
            id: row.id,
            engine: row.engine,
            name: row.name,
            host: row.host,
            port: row.port,
            username: row.username,
            password: this.decrypt(row.password),
            database: row.database,
            filePath: row.filePath,
            useSSL: Boolean(row.useSSL),
            useSSH: Boolean(row.useSSH),
            sshHost: row.sshHost,
            sshPort: row.sshPort,
            sshUser: row.sshUser,
            privateKey: this.decrypt(row.privateKey),
            passphrase: this.decrypt(row.passphrase),
            ca: this.decrypt(row.ca),
            cert: this.decrypt(row.cert),
            key: this.decrypt(row.key),
            configured: Boolean(row.configured),
            is_default: Boolean(row.is_default),
            created_at: row.created_at,
            updated_at: row.updated_at
          };
          return this.sanitizeForEngine(cfg);
        });

        resolve(configs);
      });
    });
  }

  // Get configuration by engine
  async getConfigByEngine(engine) {
    return new Promise((resolve, reject) => {
      this.db.get(
        "SELECT * FROM database_configs WHERE engine = ? AND configured = 1",
        [engine],
        (err, row) => {
          if (err) {
            reject(err);
            return;
          }

          if (!row) {
            resolve(null);
            return;
          }

          // Decrypt sensitive fields
          const config = this.sanitizeForEngine({
            id: row.id,
            engine: row.engine,
            name: row.name,
            host: row.host,
            port: row.port,
            username: row.username,
            password: this.decrypt(row.password),
            database: row.database,
            filePath: row.filePath,
            useSSL: Boolean(row.useSSL),
            useSSH: Boolean(row.useSSH),
            sshHost: row.sshHost,
            sshPort: row.sshPort,
            sshUser: row.sshUser,
            privateKey: this.decrypt(row.privateKey),
            passphrase: this.decrypt(row.passphrase),
            ca: this.decrypt(row.ca),
            cert: this.decrypt(row.cert),
            key: this.decrypt(row.key),
            configured: Boolean(row.configured),
            is_default: Boolean(row.is_default),
            created_at: row.created_at,
            updated_at: row.updated_at
          });

          resolve(config);
        }
      );
    });
  }

  // Get default configuration
  async getDefaultConfig() {
    return new Promise((resolve, reject) => {
      this.db.get(
        "SELECT * FROM database_configs WHERE is_default = 1",
        (err, row) => {
          if (err) {
            reject(err);
            return;
          }

          if (!row) {
            resolve(null);
            return;
          }

          // Decrypt sensitive fields
          const config = this.sanitizeForEngine({
            id: row.id,
            engine: row.engine,
            name: row.name,
            host: row.host,
            port: row.port,
            username: row.username,
            password: this.decrypt(row.password),
            database: row.database,
            filePath: row.filePath,
            useSSL: Boolean(row.useSSL),
            useSSH: Boolean(row.useSSH),
            sshHost: row.sshHost,
            sshPort: row.sshPort,
            sshUser: row.sshUser,
            privateKey: this.decrypt(row.privateKey),
            passphrase: this.decrypt(row.passphrase),
            ca: this.decrypt(row.ca),
            cert: this.decrypt(row.cert),
            key: this.decrypt(row.key),
            configured: Boolean(row.configured),
            is_default: Boolean(row.is_default),
            created_at: row.created_at,
            updated_at: row.updated_at
          });

          resolve(config);
        }
      );
    });
  }

  // Set default configuration
  async setDefaultConfig(engine) {
    return new Promise((resolve, reject) => {
      // First, unset all defaults
      this.db.run("UPDATE database_configs SET is_default = 0", (err) => {
        if (err) {
          reject(err);
          return;
        }

        // Set the new default
        this.db.run(
          "UPDATE database_configs SET is_default = 1 WHERE engine = ?",
          [engine],
          (err) => {
            if (err) {
              reject(err);
            } else {
              resolve();
            }
          }
        );
      });
    });
  }

  // Return a sanitized copy respecting engine-specific allowed fields
  sanitizeForEngine(input) {
    if (!input) return input;
    const cfg = { ...input };
    // Normalize engine casing just in case
    const engine = (cfg.engine || '').toLowerCase();
    cfg.engine = engine;

    if (engine === 'sqlite') {
      // Only filePath is meaningful; clear network/SSL/SSH specifics
      cfg.host = null;
      cfg.port = null;
      cfg.username = null;
      // keep password empty string if present to avoid leaking
      cfg.password = '';
      cfg.database = null;
      cfg.useSSL = false;
      cfg.useSSH = false;
      cfg.sshHost = null;
      cfg.sshPort = null;
      cfg.sshUser = null;
      cfg.privateKey = '';
      cfg.passphrase = '';
      cfg.ca = '';
      cfg.cert = '';
      cfg.key = '';
      // Ensure filePath at least defaults to bundled path
      if (!cfg.filePath) {
        cfg.filePath = join(__dirname, '..', 'drawdb.sqlite');
      }
    } else if (engine === 'mysql' || engine === 'postgresql') {
      // Network engines must not carry filePath
      cfg.filePath = null;
      // Ensure default ports if missing
      if (!cfg.port) {
        cfg.port = engine === 'mysql' ? 3306 : 5432;
      }
      // Ensure database name defaults (avoid NULL which can confuse UI)
      if (!cfg.database) cfg.database = 'drawdb';
    }
    return cfg;
  }

  // Delete configuration
  async deleteConfig(id) {
    return new Promise((resolve, reject) => {
      this.db.run("DELETE FROM database_configs WHERE id = ?", [id], (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  // Close the database connection
  close() {
    if (this.db) {
      this.db.close();
    }
  }
}

export default new ConfigManager(); 