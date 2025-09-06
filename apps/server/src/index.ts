import Fastify from 'fastify';
import cors from '@fastify/cors';

const server = Fastify({ logger: true });
await server.register(cors, { origin: true });

server.get('/healthz', async () => ({ status: 'ok' }));

// mount routes
await (await import('./api/routes.js')).registerRoutes(server);

const port = Number(process.env.PORT || 3001);
server.listen({ port, host: '0.0.0.0' }).catch((err) => { server.log.error(err); process.exit(1); });