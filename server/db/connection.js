import sqlite3 from 'sqlite3';
import mysql from 'mysql2/promise';
import pkg from 'pg';
const { Client } = pkg;
import { Client as SSHClient } from 'ssh2';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import crypto from 'crypto';
import fs from 'fs';
import configManager from './config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class ConnectionManager {
  constructor() {
    this.currentConnection = null;
    this.connectionConfig = null;
    this.sshTunnel = null;
  }

  // Initialize the connection manager
  async init() {
    await configManager.init();
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
          return;
        }

        // Create the diagrams table if it doesn't exist
        db.run(`
          CREATE TABLE IF NOT EXISTS diagrams (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            database_type TEXT NOT NULL,
            content TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `, (err) => {
          if (err) {
            db.close();
            reject(new Error(`SQLite table creation failed: ${err.message}`));
            return;
          }

          db.close();
          resolve({ success: true, message: 'SQLite connection successful' });
        });
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

      // Connect to MySQL without specifying a database
      const mysqlConfig = {
        host: config.useSSH ? '127.0.0.1' : config.host,
        port: config.useSSH ? sshTunnel.localPort : config.port,
        user: config.username,
        password: config.password,
        ssl: config.useSSL ? {
          ca: config.ca,
          cert: config.cert,
          key: config.key
        } : false
      };

      connection = await mysql.createConnection(mysqlConfig);

      // Create database if it doesn't exist (use query, not execute for DDL)
      await connection.query(`CREATE DATABASE IF NOT EXISTS \`${config.database}\``);
      console.log(`Ensured database exists: ${config.database}`);
      
      // Use the database (use query, not execute for DDL)
      await connection.query(`USE \`${config.database}\``);

      // Create the diagrams table if it doesn't exist (use query, not execute for DDL)
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
      
      await connection.query(createTableSQL);
      
      return { success: true, message: 'MySQL connection successful' };
    } finally {
      if (connection) await connection.end();
      if (sshTunnel) sshTunnel.close();
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

      // First, connect to the default 'postgres' database to create our target database
      const pgConfig = {
        host: config.useSSH ? '127.0.0.1' : config.host,
        port: config.useSSH ? sshTunnel.localPort : config.port,
        user: config.username,
        password: config.password,
        database: 'postgres', // Connect to default database first
        ssl: config.useSSL ? {
          ca: config.ca,
          cert: config.cert,
          key: config.key
        } : false
      };

      client = new Client(pgConfig);
      await client.connect();

      // Check if our target database exists
      const dbExistsResult = await client.query(
        "SELECT 1 FROM pg_database WHERE datname = $1",
        [config.database]
      );

      if (dbExistsResult.rows.length === 0) {
        // Database doesn't exist, create it
        await client.query(`CREATE DATABASE "${config.database}"`);
        console.log(`Created database: ${config.database}`);
      }

      // Close connection to postgres database
      await client.end();

      // Now connect to our target database
      pgConfig.database = config.database;
      client = new Client(pgConfig);
      await client.connect();

      // Create the diagrams table if it doesn't exist
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

      await client.query(createTableSQL);
      
      return { success: true, message: 'PostgreSQL connection successful' };
    } finally {
      if (client) await client.end();
      if (sshTunnel) sshTunnel.close();
    }
  }

  // Connect to a database using configuration
  async connect(config) {
    try {
      // Save the configuration
      await configManager.saveConfig(config);
      
      // Set as default if specified
      if (config.is_default) {
        await configManager.setDefaultConfig(config.engine);
      }

      switch (config.engine) {
        case 'sqlite':
          return await this.connectSQLite(config);
        
        case 'mysql':
          return await this.connectMySQL(config);
        
        case 'postgresql':
          return await this.connectPostgres(config);
        
        default:
          throw new Error(`Unsupported database engine: ${config.engine}`);
      }
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
          reject(new Error(`SQLite connection failed: ${err.message}`));
          return;
        }

        // Create the diagrams table if it doesn't exist
        db.run(`
          CREATE TABLE IF NOT EXISTS diagrams (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            database_type TEXT NOT NULL,
            content TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `, (err) => {
          if (err) {
            db.close();
            reject(new Error(`SQLite table creation failed: ${err.message}`));
            return;
          }

          this.currentConnection = db;
          this.connectionConfig = config;
          console.log(`Connected to ${config.engine} database`);
          resolve(db);
        });
      });
    });
  }

  async connectMySQL(config) {
    let sshTunnel = null;

    try {
      // Create SSH tunnel if needed
      if (config.useSSH) {
        const stream = await this.createSSHTunnel(config);
        sshTunnel = stream;
      }

      // Connect to MySQL without specifying a database
      const mysqlConfig = {
        host: config.useSSH ? '127.0.0.1' : config.host,
        port: config.useSSH ? sshTunnel.localPort : config.port,
        user: config.username,
        password: config.password,
        ssl: config.useSSL ? {
          ca: config.ca,
          cert: config.cert,
          key: config.key
        } : false
      };

      const connection = await mysql.createConnection(mysqlConfig);

      // Create database if it doesn't exist (use query, not execute for DDL)
      await connection.query(`CREATE DATABASE IF NOT EXISTS \`${config.database}\``);
      console.log(`Ensured database exists: ${config.database}`);
      
      // Use the database (use query, not execute for DDL)
      await connection.query(`USE \`${config.database}\``);

      // Create the diagrams table if it doesn't exist (use query, not execute for DDL)
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
      
      await connection.query(createTableSQL);

      // Store SSH tunnel reference
      if (sshTunnel) {
        connection.sshTunnel = sshTunnel;
      }

      this.currentConnection = connection;
      this.connectionConfig = config;
      console.log(`Connected to ${config.engine} database`);
      return connection;
    } catch (error) {
      if (sshTunnel) sshTunnel.close();
      throw error;
    }
  }

  async connectPostgres(config) {
    let sshTunnel = null;

    try {
      // Create SSH tunnel if needed
      if (config.useSSH) {
        const stream = await this.createSSHTunnel(config);
        sshTunnel = stream;
      }

      // First, connect to the default 'postgres' database to create our target database
      const pgConfig = {
        host: config.useSSH ? '127.0.0.1' : config.host,
        port: config.useSSH ? sshTunnel.localPort : config.port,
        user: config.username,
        password: config.password,
        database: 'postgres', // Connect to default database first
        ssl: config.useSSL ? {
          ca: config.ca,
          cert: config.cert,
          key: config.key
        } : false
      };

      let client = new Client(pgConfig);
      await client.connect();

      // Check if our target database exists
      const dbExistsResult = await client.query(
        "SELECT 1 FROM pg_database WHERE datname = $1",
        [config.database]
      );

      if (dbExistsResult.rows.length === 0) {
        // Database doesn't exist, create it
        await client.query(`CREATE DATABASE "${config.database}"`);
        console.log(`Created database: ${config.database}`);
      }

      // Close connection to postgres database
      await client.end();

      // Now connect to our target database
      pgConfig.database = config.database;
      client = new Client(pgConfig);
      await client.connect();

      // Create the diagrams table if it doesn't exist
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

      await client.query(createTableSQL);

      // Store SSH tunnel reference
      if (sshTunnel) {
        client.sshTunnel = sshTunnel;
      }

      this.currentConnection = client;
      this.connectionConfig = config;
      console.log(`Connected to ${config.engine} database`);
      return client;
    } catch (error) {
      if (sshTunnel) sshTunnel.close();
      throw error;
    }
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

  // Get all configurations
  async getAllConfigs() {
    return await configManager.getAllConfigs();
  }

  // Get configuration by engine
  async getConfigByEngine(engine) {
    return await configManager.getConfigByEngine(engine);
  }

  // Get default configuration
  async getDefaultConfig() {
    return await configManager.getDefaultConfig();
  }

  // Save configuration
  async saveConfig(config) {
    return await configManager.saveConfig(config);
  }

  // Delete configuration
  async deleteConfig(id) {
    return await configManager.deleteConfig(id);
  }

  // Connect to default database
  async connectToDefault() {
    const defaultConfig = await configManager.getDefaultConfig();
    if (defaultConfig) {
      return await this.connect(defaultConfig);
    }
    throw new Error('No default database configuration found');
  }
}

export default new ConnectionManager(); 