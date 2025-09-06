import { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { buildPrompt } from '../modules/prompt-engine/buildPrompt.js';

const RequestSchema = z.object({
  taskType: z.enum(['generate_sql','explain_sql','optimize_sql']),
  dialect: z.enum(['postgres','mysql']),
  schema: z.record(z.string(), z.any()).optional(),
  question: z.string().optional(),
  sql: z.string().optional(),
  constraints: z.record(z.string(), z.any()).optional(),
  context: z.record(z.string(), z.any()).optional()
});

export async function generatePromptHandler(req: FastifyRequest, reply: FastifyReply) {
  const parse = RequestSchema.safeParse(req.body);
  if (!parse.success) return reply.code(400).send({ code: 'VALIDATION_ERROR', message: 'invalid body', details: parse.error.flatten() });
  const result = buildPrompt(parse.data);
  return reply.send(result);
}