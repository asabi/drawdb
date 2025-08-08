import sqlite3 from 'sqlite3';
import mysql from 'mysql2/promise';
import pkg from 'pg';
const { Client } = pkg;
import { Client as SSHClient } from 'ssh2';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import crypto from 'crypto';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class ConnectionManager {
  constructor() {
    this.currentConnection = null;
    this.connectionConfig = null;
    this.sshTunnel = null;
  }

  // Encrypt sensitive data
  encrypt(text, key = process.env.ENCRYPTION_KEY || 'default-key-change-in-production') {
    const cipher = crypto.createCipher('aes-256-cbc', key);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return encrypted;
  }

  // Decrypt sensitive data
  decrypt(encryptedText, key = process.env.ENCRYPTION_KEY || 'default-key-change-in-production') {
    const decipher = crypto.createDecipher('aes-256-cbc', key);
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  // Create SSH tunnel
  async createSSHTunnel(config) {
    return new Promise((resolve, reject) => {
      const sshConfig = {
        host: config.sshHost,
        port: config.sshPort || 22,
        username: config.sshUser,
        privateKey: config.privateKey,
        passphrase: config.passphrase
      };

      const sshClient = new SSHClient();
      
      sshClient.on('ready', () => {
        sshClient.forwardOut(
          '127.0.0.1',
          0,
          config.host,
          config.port,
          (err, stream) => {
            if (err) {
              sshClient.end();
              reject(err);
            } else {
              this.sshTunnel = { client: sshClient, stream };
              resolve(stream);
            }
          }
        );
      });

      sshClient.on('error', (err) => {
        reject(err);
      });

      sshClient.connect(sshConfig);
    });
  }

  // Test connection without establishing a persistent connection
  async testConnection(config) {
    try {
      switch (config.engine) {
        case 'sqlite':
          return await this.testSQLiteConnection(config);
        
        case 'mysql':
          return await this.testMySQLConnection(config);
        
        case 'postgresql':
          return await this.testPostgresConnection(config);
        
        default:
          throw new Error(`Unsupported database engine: ${config.engine}`);
      }
    } catch (error) {
      throw error;
    }
  }

  async testSQLiteConnection(config) {
    return new Promise((resolve, reject) => {
      const dbPath = config.filePath || join(__dirname, '..', 'drawdb.sqlite');
      
      // Ensure directory exists
      const dir = dirname(dbPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      const db = new sqlite3.Database(dbPath, (err) => {
        if (err) {
          reject(new Error(`SQLite connection failed: ${err.message}`));
        } else {
          db.close((closeErr) => {
            if (closeErr) {
              reject(new Error(`SQLite close failed: ${closeErr.message}`));
            } else {
              resolve({ success: true, message: 'SQLite connection successful' });
            }
          });
        }
      });
    });
  }

  async testMySQLConnection(config) {
    let connection = null;
    let sshTunnel = null;

    try {
      // Create SSH tunnel if needed
      if (config.useSSH) {
        const stream = await this.createSSHTunnel(config);
        sshTunnel = stream;
      }

      const mysqlConfig = {
        host: config.useSSH ? '127.0.0.1' : config.host,
        port: config.useSSH ? sshTunnel.localPort : config.port,
        user: config.user,
        password: config.password,
        database: config.database,
        ssl: config.useSSL ? {
          ca: config.ca,
          cert: config.cert,
          key: config.key
        } : false
      };

      connection = await mysql.createConnection(mysqlConfig);
      await connection.ping();
      
      return { success: true, message: 'MySQL connection successful' };
    } catch (error) {
      throw new Error(`MySQL connection failed: ${error.message}`);
    } finally {
      if (connection) {
        await connection.end();
      }
      if (sshTunnel) {
        sshTunnel.end();
      }
    }
  }

  async testPostgresConnection(config) {
    let client = null;
    let sshTunnel = null;

    try {
      // Create SSH tunnel if needed
      if (config.useSSH) {
        const stream = await this.createSSHTunnel(config);
        sshTunnel = stream;
      }

      const pgConfig = {
        host: config.useSSH ? '127.0.0.1' : config.host,
        port: config.useSSH ? sshTunnel.localPort : config.port,
        user: config.user,
        password: config.password,
        database: config.database,
        ssl: config.useSSL ? {
          ca: config.ca,
          cert: config.cert,
          key: config.key
        } : false
      };

      client = new Client(pgConfig);
      await client.connect();
      await client.query('SELECT 1');
      
      return { success: true, message: 'PostgreSQL connection successful' };
    } catch (error) {
      throw new Error(`PostgreSQL connection failed: ${error.message}`);
    } finally {
      if (client) {
        await client.end();
      }
      if (sshTunnel) {
        sshTunnel.end();
      }
    }
  }

  // Establish persistent connection
  async connect(config) {
    try {
      // Close existing connection
      await this.disconnect();

      this.connectionConfig = {
        ...config,
        password: this.encrypt(config.password),
        privateKey: config.privateKey ? this.encrypt(config.privateKey) : null,
        passphrase: config.passphrase ? this.encrypt(config.passphrase) : null
      };

      switch (config.engine) {
        case 'sqlite':
          this.currentConnection = await this.connectSQLite(config);
          break;
        
        case 'mysql':
          this.currentConnection = await this.connectMySQL(config);
          break;
        
        case 'postgresql':
          this.currentConnection = await this.connectPostgres(config);
          break;
        
        default:
          throw new Error(`Unsupported database engine: ${config.engine}`);
      }

      console.log(`Connected to ${config.engine} database`);
      return this.currentConnection;
    } catch (error) {
      throw error;
    }
  }

  async connectSQLite(config) {
    return new Promise((resolve, reject) => {
      const dbPath = config.filePath || join(__dirname, '..', 'drawdb.sqlite');
      
      // Ensure directory exists
      const dir = dirname(dbPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      const db = new sqlite3.Database(dbPath, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve(db);
        }
      });
    });
  }

  async connectMySQL(config) {
    let sshTunnel = null;

    // Create SSH tunnel if needed
    if (config.useSSH) {
      const stream = await this.createSSHTunnel(config);
      sshTunnel = stream;
    }

    const mysqlConfig = {
      host: config.useSSH ? '127.0.0.1' : config.host,
      port: config.useSSH ? sshTunnel.localPort : config.port,
      user: config.user,
      password: config.password,
      database: config.database,
      ssl: config.useSSL ? {
        ca: config.ca,
        cert: config.cert,
        key: config.key
      } : false
    };

    const connection = await mysql.createConnection(mysqlConfig);
    
    // Store SSH tunnel reference
    if (sshTunnel) {
      connection.sshTunnel = sshTunnel;
    }

    return connection;
  }

  async connectPostgres(config) {
    let sshTunnel = null;

    // Create SSH tunnel if needed
    if (config.useSSH) {
      const stream = await this.createSSHTunnel(config);
      sshTunnel = stream;
    }

    const pgConfig = {
      host: config.useSSH ? '127.0.0.1' : config.host,
      port: config.useSSH ? sshTunnel.localPort : config.port,
      user: config.user,
      password: config.password,
      database: config.database,
      ssl: config.useSSL ? {
        ca: config.ca,
        cert: config.cert,
        key: config.key
      } : false
    };

    const client = new Client(pgConfig);
    await client.connect();
    
    // Store SSH tunnel reference
    if (sshTunnel) {
      client.sshTunnel = sshTunnel;
    }

    return client;
  }

  // Disconnect current connection
  async disconnect() {
    if (this.currentConnection) {
      try {
        if (this.currentConnection.sshTunnel) {
          this.currentConnection.sshTunnel.end();
        }
        
        if (this.currentConnection.end) {
          await this.currentConnection.end();
        } else if (this.currentConnection.close) {
          this.currentConnection.close();
        }
      } catch (error) {
        console.error('Error disconnecting:', error);
      }
      
      this.currentConnection = null;
    }
    
    this.connectionConfig = null;
  }

  // Get current connection
  getConnection() {
    return this.currentConnection;
  }

  // Get connection config
  getConfig() {
    return this.connectionConfig;
  }

  // Check if connected
  isConnected() {
    return this.currentConnection !== null;
  }
}

export default new ConnectionManager(); 