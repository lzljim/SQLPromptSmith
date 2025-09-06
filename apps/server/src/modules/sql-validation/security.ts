import { SqlValidationRequest } from './types.js';

// 危险SQL操作检测
const DANGEROUS_PATTERNS = [
  // DDL操作
  /DROP\s+(TABLE|DATABASE|SCHEMA|INDEX|VIEW)/i,
  /CREATE\s+(TABLE|DATABASE|SCHEMA|INDEX|VIEW)/i,
  /ALTER\s+(TABLE|DATABASE|SCHEMA|INDEX|VIEW)/i,
  /TRUNCATE\s+TABLE/i,
  
  // DML操作
  /DELETE\s+FROM/i,
  /UPDATE\s+.+\s+SET/i,
  /INSERT\s+INTO/i,
  
  // 系统操作
  /GRANT\s+/i,
  /REVOKE\s+/i,
  /EXEC\s+/i,
  /EXECUTE\s+/i,
  /CALL\s+/i,
  
  // 文件操作
  /LOAD\s+DATA/i,
  /INTO\s+OUTFILE/i,
  /INTO\s+DUMPFILE/i,
  
  // 系统函数
  /SLEEP\s*\(/i,
  /BENCHMARK\s*\(/i,
  /WAITFOR\s+DELAY/i,
];

// 只读操作检测
const READONLY_PATTERNS = [
  /SELECT\s+/i,
  /WITH\s+.+\s+SELECT/i,
  /EXPLAIN\s+/i,
  /DESCRIBE\s+/i,
  /SHOW\s+/i,
  /PRAGMA\s+/i,
];

export function analyzeSqlSecurity(sql: string, options: { readonly?: boolean } = {}): {
  isReadOnly: boolean;
  warnings: string[];
  blockedOperations: string[];
} {
  const warnings: string[] = [];
  const blockedOperations: string[] = [];
  
  // 检查危险操作
  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(sql)) {
      const match = sql.match(pattern);
      if (match) {
        blockedOperations.push(match[0]);
        warnings.push(`检测到危险操作: ${match[0]}`);
      }
    }
  }
  
  // 检查是否为只读操作
  const isReadOnly = READONLY_PATTERNS.some(pattern => pattern.test(sql)) && 
                     !DANGEROUS_PATTERNS.some(pattern => pattern.test(sql));
  
  // 如果要求只读但检测到非只读操作
  if (options.readonly && !isReadOnly) {
    warnings.push('SQL包含非只读操作，但当前为只读模式');
  }
  
  // 检查SQL长度
  if (sql.length > 10000) {
    warnings.push('SQL语句过长，可能存在性能风险');
  }
  
  // 检查注释中的潜在问题
  if (sql.includes('--') && sql.includes('DROP')) {
    warnings.push('SQL中包含注释和DROP操作，请仔细检查');
  }
  
  return {
    isReadOnly,
    warnings,
    blockedOperations
  };
}

export function validateSqlSafety(sql: string, options: { readonly?: boolean } = {}): boolean {
  const security = analyzeSqlSecurity(sql, options);
  
  // 如果要求只读模式，必须通过只读检查
  if (options.readonly && !security.isReadOnly) {
    return false;
  }
  
  // 不能包含被阻止的操作
  if (security.blockedOperations.length > 0) {
    return false;
  }
  
  return true;
}