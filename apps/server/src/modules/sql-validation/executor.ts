import { DatabaseConnection, SqlValidationResult, SqlExecutionOptions } from './types.js';
import { analyzeSqlSecurity, validateSqlSafety } from './security.js';
import { connectionManager } from '../database/connection-manager.js';

export class SqlExecutor {
  private connection: DatabaseConnection;
  private options: SqlExecutionOptions;
  private connectionId?: string;

  constructor(connection: DatabaseConnection, options: SqlExecutionOptions) {
    this.connection = connection;
    this.options = options;
  }

  async initialize(): Promise<void> {
    this.connectionId = await connectionManager.createConnection(this.connection);
  }

  async cleanup(): Promise<void> {
    if (this.connectionId) {
      await connectionManager.closeConnection(this.connectionId);
    }
  }

  async validateSql(sql: string): Promise<SqlValidationResult> {
    const result: SqlValidationResult = {
      isValid: false,
      syntaxCheck: { valid: false },
      securityCheck: {
        isReadOnly: false,
        warnings: [],
        blockedOperations: []
      }
    };

    try {
      // 1. 安全检查
      const security = analyzeSqlSecurity(sql, { readonly: this.options.readonly });
      result.securityCheck = security;

      if (!validateSqlSafety(sql, { readonly: this.options.readonly })) {
        result.isValid = false;
        return result;
      }

      // 2. 语法检查
      const syntaxResult = await this.checkSyntax(sql);
      result.syntaxCheck = syntaxResult;

      if (!syntaxResult.valid) {
        result.isValid = false;
        return result;
      }

      // 3. 执行计划分析
      if (this.options.explain) {
        try {
          result.executionPlan = await this.getExecutionPlan(sql);
        } catch (error) {
          result.executionPlan = {
            plan: null,
            warnings: [`执行计划分析失败: ${error instanceof Error ? error.message : '未知错误'}`]
          };
        }
      }

      // 4. 样本结果执行
      try {
        result.sampleResults = await this.executeSample(sql);
      } catch (error) {
        result.sampleResults = {
          columns: [],
          rows: [],
          executionTime: 0
        };
        result.securityCheck.warnings.push(`样本执行失败: ${error instanceof Error ? error.message : '未知错误'}`);
      }

      // 5. 元数据分析
      result.metadata = this.analyzeMetadata(sql);

      result.isValid = true;
      return result;

    } catch (error) {
      result.syntaxCheck.error = error instanceof Error ? error.message : '未知错误';
      return result;
    }
  }

  private async checkSyntax(sql: string): Promise<{ valid: boolean; error?: string }> {
    try {
      // 根据数据库类型进行语法检查
      switch (this.connection.dialect) {
        case 'postgres':
          return await this.checkPostgresSyntax(sql);
        case 'mysql':
          return await this.checkMysqlSyntax(sql);
        case 'sqlite':
          return await this.checkSqliteSyntax(sql);
        case 'mssql':
          return await this.checkMssqlSyntax(sql);
        default:
          return { valid: false, error: '不支持的数据库类型' };
      }
    } catch (error) {
      return { valid: false, error: error instanceof Error ? error.message : '语法检查失败' };
    }
  }

  private async checkPostgresSyntax(sql: string): Promise<{ valid: boolean; error?: string }> {
    // 使用EXPLAIN进行语法检查
    const explainSql = `EXPLAIN (FORMAT JSON) ${sql}`;
    try {
      await this.executeQuery(explainSql);
      return { valid: true };
    } catch (error) {
      return { valid: false, error: error instanceof Error ? error.message : 'PostgreSQL语法错误' };
    }
  }

  private async checkMysqlSyntax(sql: string): Promise<{ valid: boolean; error?: string }> {
    // 使用EXPLAIN进行语法检查
    const explainSql = `EXPLAIN ${sql}`;
    try {
      await this.executeQuery(explainSql);
      return { valid: true };
    } catch (error) {
      return { valid: false, error: error instanceof Error ? error.message : 'MySQL语法错误' };
    }
  }

  private async checkSqliteSyntax(sql: string): Promise<{ valid: boolean; error?: string }> {
    // SQLite使用EXPLAIN QUERY PLAN
    const explainSql = `EXPLAIN QUERY PLAN ${sql}`;
    try {
      await this.executeQuery(explainSql);
      return { valid: true };
    } catch (error) {
      return { valid: false, error: error instanceof Error ? error.message : 'SQLite语法错误' };
    }
  }

  private async checkMssqlSyntax(sql: string): Promise<{ valid: boolean; error?: string }> {
    // SQL Server使用SET SHOWPLAN_ALL
    try {
      await this.executeQuery(`SET SHOWPLAN_ALL ON; ${sql}; SET SHOWPLAN_ALL OFF;`);
      return { valid: true };
    } catch (error) {
      return { valid: false, error: error instanceof Error ? error.message : 'SQL Server语法错误' };
    }
  }

  private async getExecutionPlan(sql: string): Promise<{ plan: any; cost?: number; warnings?: string[] }> {
    const warnings: string[] = [];
    
    try {
      let planSql: string;
      switch (this.connection.dialect) {
        case 'postgres':
          planSql = `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${sql}`;
          break;
        case 'mysql':
          planSql = `EXPLAIN FORMAT=JSON ${sql}`;
          break;
        case 'sqlite':
          planSql = `EXPLAIN QUERY PLAN ${sql}`;
          break;
        case 'mssql':
          planSql = `SET SHOWPLAN_XML ON; ${sql}; SET SHOWPLAN_XML OFF;`;
          break;
        default:
          throw new Error('不支持的数据库类型');
      }

      const result = await this.executeQuery(planSql);
      return { plan: result, warnings };
    } catch (error) {
      warnings.push(`执行计划获取失败: ${error instanceof Error ? error.message : '未知错误'}`);
      return { plan: null, warnings };
    }
  }

  private async executeSample(sql: string): Promise<{
    columns: Array<{ name: string; type: string }>;
    rows: any[][];
    totalRows?: number;
    executionTime: number;
  }> {
    const startTime = Date.now();
    
    // 添加LIMIT限制
    const limitedSql = this.addLimit(sql, this.options.maxRows);
    
    try {
      const result = await this.executeQuery(limitedSql);
      const executionTime = Date.now() - startTime;
      
      // 获取列信息
      const columns = result.fields?.map((field: any) => ({
        name: field.name,
        type: field.dataTypeID ? this.getDataTypeName(field.dataTypeID) : 'unknown'
      })) || [];
      
      // 获取行数据
      const rows = result.rows || [];
      
      return {
        columns,
        rows,
        executionTime
      };
    } catch (error) {
      throw new Error(`样本执行失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  private addLimit(sql: string, maxRows: number): string {
    const trimmedSql = sql.trim();
    const upperSql = trimmedSql.toUpperCase();
    
    // 如果已经有LIMIT，不添加
    if (upperSql.includes('LIMIT') || upperSql.includes('TOP')) {
      return sql;
    }
    
    // 根据数据库类型添加限制
    switch (this.connection.dialect) {
      case 'postgres':
      case 'mysql':
      case 'sqlite':
        return `${sql} LIMIT ${maxRows}`;
      case 'mssql':
        // SQL Server使用TOP
        if (upperSql.startsWith('SELECT')) {
          return sql.replace(/^SELECT/i, `SELECT TOP ${maxRows}`);
        }
        return sql;
      default:
        return sql;
    }
  }

  private analyzeMetadata(sql: string): {
    affectedTables: string[];
    estimatedRows: number;
    complexity: 'low' | 'medium' | 'high';
  } {
    const affectedTables: string[] = [];
    const upperSql = sql.toUpperCase();
    
    // 简单的表名提取（实际项目中可以使用SQL解析器）
    const tableMatches = sql.match(/(?:FROM|JOIN|UPDATE|INSERT INTO|DELETE FROM)\s+([a-zA-Z_][a-zA-Z0-9_]*)/gi);
    if (tableMatches) {
      tableMatches.forEach(match => {
        const tableName = match.replace(/(?:FROM|JOIN|UPDATE|INSERT INTO|DELETE FROM)\s+/i, '').trim();
        if (tableName && !affectedTables.includes(tableName)) {
          affectedTables.push(tableName);
        }
      });
    }
    
    // 复杂度评估
    let complexity: 'low' | 'medium' | 'high' = 'low';
    if (upperSql.includes('JOIN') || upperSql.includes('UNION')) {
      complexity = 'medium';
    }
    if (upperSql.includes('SUBQUERY') || upperSql.includes('WITH') || upperSql.includes('WINDOW')) {
      complexity = 'high';
    }
    
    return {
      affectedTables,
      estimatedRows: 0, // 实际项目中可以从执行计划中获取
      complexity
    };
  }

  private getDataTypeName(dataTypeId: number): string {
    // 简化的数据类型映射，实际项目中需要完整的映射表
    const typeMap: Record<number, string> = {
      20: 'bigint',
      21: 'smallint',
      23: 'integer',
      25: 'text',
      1043: 'varchar',
      1082: 'date',
      1114: 'timestamp',
      1700: 'numeric'
    };
    return typeMap[dataTypeId] || 'unknown';
  }

  private async executeQuery(sql: string): Promise<any> {
    if (!this.connectionId) {
      throw new Error('数据库连接未初始化');
    }
    
    return await connectionManager.executeQuery(this.connectionId, sql, {
      readonly: this.options.readonly,
      timeout: this.options.timeout,
      maxRows: this.options.maxRows
    });
  }
}