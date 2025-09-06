import { FastifyInstance } from 'fastify';
import { generatePromptHandler } from './routes_generate_prompt.js';

export async function registerRoutes(app: FastifyInstance) {
  app.post('/api/generate-prompt', generatePromptHandler);
}