import { DatabaseConnection } from '../sql-validation/types.js';
import pg from 'pg';
import mysql from 'mysql2/promise';
import sqlite3 from 'sqlite3';
import mssql from 'mssql';

export class DatabaseConnectionManager {
  private connections: Map<string, any> = new Map();

  async createConnection(connection: DatabaseConnection): Promise<string> {
    const connectionId = this.generateConnectionId();
    
    try {
      let dbConnection: any;
      
      switch (connection.dialect) {
        case 'postgres':
          dbConnection = await this.createPostgresConnection(connection);
          break;
        case 'mysql':
          dbConnection = await this.createMysqlConnection(connection);
          break;
        case 'sqlite':
          dbConnection = await this.createSqliteConnection(connection);
          break;
        case 'mssql':
          dbConnection = await this.createMssqlConnection(connection);
          break;
        default:
          throw new Error(`不支持的数据库类型: ${connection.dialect}`);
      }
      
      this.connections.set(connectionId, {
        connection: dbConnection,
        config: connection,
        createdAt: new Date()
      });
      
      return connectionId;
    } catch (error) {
      throw new Error(`数据库连接失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  async testConnection(connection: DatabaseConnection): Promise<boolean> {
    try {
      const connectionId = await this.createConnection(connection);
      await this.closeConnection(connectionId);
      return true;
    } catch {
      return false;
    }
  }

  async executeQuery(connectionId: string, sql: string, options: {
    readonly?: boolean;
    timeout?: number;
    maxRows?: number;
  } = {}): Promise<any> {
    const conn = this.connections.get(connectionId);
    if (!conn) {
      throw new Error('数据库连接不存在');
    }

    const { connection, config } = conn;
    
    // 设置超时
    const timeout = options.timeout || 30000;
    const maxRows = options.maxRows || 1000;
    
    try {
      switch (config.dialect) {
        case 'postgres':
          return await this.executePostgresQuery(connection, sql, { timeout, maxRows });
        case 'mysql':
          return await this.executeMysqlQuery(connection, sql, { timeout, maxRows });
        case 'sqlite':
          return await this.executeSqliteQuery(connection, sql, { timeout, maxRows });
        case 'mssql':
          return await this.executeMssqlQuery(connection, sql, { timeout, maxRows });
        default:
          throw new Error(`不支持的数据库类型: ${config.dialect}`);
      }
    } catch (error) {
      throw new Error(`查询执行失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  async closeConnection(connectionId: string): Promise<void> {
    const conn = this.connections.get(connectionId);
    if (conn) {
      try {
        await conn.connection.end?.() || conn.connection.close?.();
      } catch (error) {
        console.warn('关闭数据库连接时出错:', error);
      }
      this.connections.delete(connectionId);
    }
  }

  async closeAllConnections(): Promise<void> {
    const promises = Array.from(this.connections.keys()).map(id => this.closeConnection(id));
    await Promise.all(promises);
  }

  private generateConnectionId(): string {
    return `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private async createPostgresConnection(connection: DatabaseConnection): Promise<pg.Client> {
    const client = new pg.Client({
      host: connection.host || 'localhost',
      port: connection.port || 5432,
      database: connection.database,
      user: connection.username,
      password: connection.password,
      ssl: connection.ssl ? { rejectUnauthorized: false } : false,
      connectionTimeoutMillis: 10000,
      query_timeout: 30000
    });
    
    await client.connect();
    return client;
  }

  private async createMysqlConnection(connection: DatabaseConnection): Promise<mysql.Connection> {
    return await mysql.createConnection({
      host: connection.host || 'localhost',
      port: connection.port || 3306,
      database: connection.database,
      user: connection.username,
      password: connection.password,
      ssl: connection.ssl ? {} : false,
      connectTimeout: 10000,
      acquireTimeout: 10000
    });
  }

  private async createSqliteConnection(connection: DatabaseConnection): Promise<sqlite3.Database> {
    return new Promise((resolve, reject) => {
      const db = new sqlite3.Database(connection.database, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve(db);
        }
      });
    });
  }

  private async createMssqlConnection(connection: DatabaseConnection): Promise<mssql.ConnectionPool> {
    const config: mssql.config = {
      server: connection.host || 'localhost',
      port: connection.port || 1433,
      database: connection.database,
      user: connection.username,
      password: connection.password,
      options: {
        encrypt: connection.ssl || false,
        trustServerCertificate: true,
        connectTimeout: 10000,
        requestTimeout: 30000
      }
    };
    
    const pool = await mssql.connect(config);
    return pool;
  }

  private async executePostgresQuery(connection: pg.Client, sql: string, options: { timeout: number; maxRows: number }): Promise<any> {
    const result = await connection.query(sql);
    return {
      rows: result.rows.slice(0, options.maxRows),
      fields: result.fields,
      rowCount: result.rowCount
    };
  }

  private async executeMysqlQuery(connection: mysql.Connection, sql: string, options: { timeout: number; maxRows: number }): Promise<any> {
    const [rows, fields] = await connection.execute(sql);
    return {
      rows: Array.isArray(rows) ? rows.slice(0, options.maxRows) : [],
      fields: fields?.map(field => ({ name: field.name, dataTypeID: field.type })),
      rowCount: Array.isArray(rows) ? rows.length : 0
    };
  }

  private async executeSqliteQuery(connection: sqlite3.Database, sql: string, options: { timeout: number; maxRows: number }): Promise<any> {
    return new Promise((resolve, reject) => {
      const rows: any[] = [];
      connection.all(sql, (err, result) => {
        if (err) {
          reject(err);
        } else {
          resolve({
            rows: (result || []).slice(0, options.maxRows),
            fields: [], // SQLite需要额外查询获取字段信息
            rowCount: result?.length || 0
          });
        }
      });
    });
  }

  private async executeMssqlQuery(connection: mssql.ConnectionPool, sql: string, options: { timeout: number; maxRows: number }): Promise<any> {
    const request = connection.request();
    request.timeout = options.timeout;
    
    const result = await request.query(sql);
    return {
      rows: result.recordset.slice(0, options.maxRows),
      fields: result.recordset.columns ? Object.keys(result.recordset.columns).map(name => ({ name })) : [],
      rowCount: result.recordset.length
    };
  }
}

// 单例模式
export const connectionManager = new DatabaseConnectionManager();