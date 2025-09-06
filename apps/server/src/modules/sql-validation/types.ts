export interface DatabaseConnection {
  dialect: 'postgres' | 'mysql' | 'sqlite' | 'mssql';
  host?: string;
  port?: number;
  database: string;
  username?: string;
  password?: string;
  connectionString?: string;
  ssl?: boolean;
}

export interface SqlValidationRequest {
  sql: string;
  connection: DatabaseConnection;
  options?: {
    readonly?: boolean;
    timeout?: number;
    maxRows?: number;
    explain?: boolean;
  };
}

export interface SqlValidationResult {
  isValid: boolean;
  syntaxCheck: {
    valid: boolean;
    error?: string;
  };
  executionPlan?: {
    plan: any;
    cost?: number;
    warnings?: string[];
  };
  sampleResults?: {
    columns: Array<{ name: string; type: string }>;
    rows: any[][];
    totalRows?: number;
    executionTime: number;
  };
  securityCheck: {
    isReadOnly: boolean;
    warnings: string[];
    blockedOperations: string[];
  };
  metadata?: {
    affectedTables: string[];
    estimatedRows: number;
    complexity: 'low' | 'medium' | 'high';
  };
}

export interface SqlExecutionOptions {
  readonly: boolean;
  timeout: number;
  maxRows: number;
  explain: boolean;
}