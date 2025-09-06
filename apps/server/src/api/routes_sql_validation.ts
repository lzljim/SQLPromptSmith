import { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { SqlExecutor } from '../modules/sql-validation/executor.js';
import { DatabaseConnection, SqlExecutionOptions } from '../modules/sql-validation/types.js';
import { connectionManager } from '../modules/database/connection-manager.js';

const SqlValidationRequestSchema = z.object({
  sql: z.string().min(1, 'SQL语句不能为空'),
  connection: z.object({
    dialect: z.enum(['postgres', 'mysql', 'sqlite', 'mssql']),
    host: z.string().optional(),
    port: z.number().optional(),
    database: z.string(),
    username: z.string().optional(),
    password: z.string().optional(),
    connectionString: z.string().optional(),
    ssl: z.boolean().optional()
  }),
  options: z.object({
    readonly: z.boolean().default(true),
    timeout: z.number().min(1000).max(300000).default(30000),
    maxRows: z.number().min(1).max(10000).default(1000),
    explain: z.boolean().default(true)
  }).optional()
});

const TestConnectionRequestSchema = z.object({
  connection: z.object({
    dialect: z.enum(['postgres', 'mysql', 'sqlite', 'mssql']),
    host: z.string().optional(),
    port: z.number().optional(),
    database: z.string(),
    username: z.string().optional(),
    password: z.string().optional(),
    connectionString: z.string().optional(),
    ssl: z.boolean().optional()
  })
});

export async function validateSqlHandler(req: FastifyRequest, reply: FastifyReply) {
  try {
    const parse = SqlValidationRequestSchema.safeParse(req.body);
    if (!parse.success) {
      return reply.code(400).send({
        code: 'VALIDATION_ERROR',
        message: '请求参数验证失败',
        details: parse.error.flatten()
      });
    }

    const { sql, connection, options = {} } = parse.data;
    
    // 设置默认选项
    const executionOptions: SqlExecutionOptions = {
      readonly: options.readonly ?? true,
      timeout: options.timeout ?? 30000,
      maxRows: options.maxRows ?? 1000,
      explain: options.explain ?? true
    };

    // 创建SQL执行器
    const executor = new SqlExecutor(connection as DatabaseConnection, executionOptions);
    
    try {
      // 初始化连接
      await executor.initialize();
      
      // 执行验证
      const result = await executor.validateSql(sql);
      
      return reply.send({
        success: true,
        data: result,
        requestId: req.id
      });
      
    } finally {
      // 清理连接
      await executor.cleanup();
    }
    
  } catch (error) {
    req.log.error('SQL验证失败:', error);
    
    return reply.code(500).send({
      code: 'EXECUTION_ERROR',
      message: 'SQL验证执行失败',
      details: error instanceof Error ? error.message : '未知错误',
      requestId: req.id
    });
  }
}

export async function testConnectionHandler(req: FastifyRequest, reply: FastifyReply) {
  try {
    const parse = TestConnectionRequestSchema.safeParse(req.body);
    if (!parse.success) {
      return reply.code(400).send({
        code: 'VALIDATION_ERROR',
        message: '请求参数验证失败',
        details: parse.error.flatten()
      });
    }

    const { connection } = parse.data;
    
    // 测试连接
    const isConnected = await connectionManager.testConnection(connection as DatabaseConnection);
    
    return reply.send({
      success: true,
      data: {
        connected: isConnected,
        dialect: connection.dialect,
        database: connection.database
      },
      requestId: req.id
    });
    
  } catch (error) {
    req.log.error('连接测试失败:', error);
    
    return reply.code(500).send({
      code: 'CONNECTION_ERROR',
      message: '数据库连接测试失败',
      details: error instanceof Error ? error.message : '未知错误',
      requestId: req.id
    });
  }
}

export async function getSupportedDialectsHandler(req: FastifyRequest, reply: FastifyReply) {
  const dialects = [
    {
      name: 'PostgreSQL',
      value: 'postgres',
      description: 'PostgreSQL 数据库',
      features: ['语法检查', '执行计划', '样本执行', '安全检查']
    },
    {
      name: 'MySQL',
      value: 'mysql',
      description: 'MySQL 数据库',
      features: ['语法检查', '执行计划', '样本执行', '安全检查']
    },
    {
      name: 'SQLite',
      value: 'sqlite',
      description: 'SQLite 数据库',
      features: ['语法检查', '执行计划', '样本执行', '安全检查']
    },
    {
      name: 'SQL Server',
      value: 'mssql',
      description: 'Microsoft SQL Server 数据库',
      features: ['语法检查', '执行计划', '样本执行', '安全检查']
    }
  ];

  return reply.send({
    success: true,
    data: dialects,
    requestId: req.id
  });
}