import { FastifyInstance } from 'fastify';
import { generatePromptHandler } from './routes_generate_prompt.js';
import { 
  validateSqlHandler, 
  testConnectionHandler, 
  getSupportedDialectsHandler 
} from './routes_sql_validation.js';

export async function registerRoutes(app: FastifyInstance) {
  // 原有的提示词生成路由
  app.post('/api/generate-prompt', generatePromptHandler);
  
  // SQL验证相关路由
  app.post('/api/sql/validate', validateSqlHandler);
  app.post('/api/sql/test-connection', testConnectionHandler);
  app.get('/api/sql/dialects', getSupportedDialectsHandler);
}