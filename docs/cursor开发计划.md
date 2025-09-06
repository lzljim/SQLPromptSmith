## AI SQL 提示词生成工具 — 开发计划（Cursor 可执行）

本计划基于 `docs/需求分析.md`，按阶段（M1/M2/M3）拆分目标、范围、交付物与可在 Cursor 终端直接执行的步骤与命令。计划默认采用 Node.js + TypeScript（Fastify）后端与 React + Vite + Ant Design 前端。数据库直连为可选能力，M1 聚焦离线 Schema 上下文与提示词生成核心。

---

### 总览

- 代码结构建议（单仓多应用）：
  - `apps/server`：Node.js + TS 后端（Fastify）
  - `apps/web`：Vite + React + TS 前端（AntD）
  - `packages/shared`：共享类型与工具（Schema JSON 类型、常量、校验）
  - `docs/`：文档
- 包管理：npm（可替换为 pnpm/yarn，命令据此调整）
- 主要里程碑：
  - M1（核心 MVP）：提示词模板 + 生成引擎 + 基本裁剪 + 离线 Schema 输入 + 最小 Web/CLI
  - M2（增强）：可选直连与采样/脱敏、版本化/历史、编辑器插件、更多 API
  - M3（企业）：SSO、审计、远程代理、更多云数仓、质量评估与沙箱

---

### M1（核心 MVP）

#### 目标
- 在无数据库连接前提下，基于用户提供的 Schema 片段/DDL/JSON 与任务输入，生成高质量 SQL 提示词（文本 + JSON）。
- 覆盖三类任务模板：生成/解释/优化，并提供方言适配与上下文裁剪。
- 提供最小可用 Web 向导与 `POST /api/generate-prompt` API，含健康检查与统一错误模型。

#### 范围
- 模块：`templates`、`prompt-engine`、`schema-model`（校验/裁剪）、`api`（generate-prompt、healthz）。
- 前端：上传/粘贴 Schema、选择任务与方言、输入问题/SQL、预览提示词（文本/JSON）、复制导出。
- 文档与验收：OpenAPI（最小子集）、运行与构建脚本、验收清单。

#### 交付物
- 后端服务（可本地运行/容器化）：最小 API 可用。
- 前端最小向导页可操作，能成功调用 `generate-prompt` 并展示结果。
- 模板与方言差异的初始库，覆盖 Postgres/MySQL。

#### 任务拆解与 Cursor 可执行步骤

1) 仓库初始化与结构

```bash
mkdir -p apps/server apps/web packages/shared && cd apps/server && npm init -y && cd ../../
cd packages/shared && npm init -y && cd ../../
```

2) 后端基础（Fastify + TS）

```bash
cd apps/server && npm i fastify fastify-cors fastify-plugin zod pino dotenv && \
npm i -D typescript tsx @types/node eslint @typescript-eslint/parser @typescript-eslint/eslint-plugin && \
npx tsc --init --rootDir src --outDir dist --esModuleInterop --module commonjs --target es2020 --resolveJsonModule && \
mkdir -p src/api src/modules/{templates,prompt-engine,schema-model} src/config src/utils

# 基础文件
printf "PORT=3001\nLOG_LEVEL=info\n" > .env

# package.json 脚本（追加/替换）
node -e "const fs=require('fs');const p=require('./package.json');p.type='module';p.scripts={dev:'tsx watch src/index.ts',start:'node dist/index.js',build:'tsc -p tsconfig.json',lint:'eslint \'src/**/*.ts\''};fs.writeFileSync('package.json',JSON.stringify(p,null,2));"

# 创建 Fastify 入口
cat > src/index.ts << 'EOF'
import Fastify from 'fastify';
import cors from '@fastify/cors';

const server = Fastify({ logger: true });
await server.register(cors, { origin: true });

server.get('/healthz', async () => ({ status: 'ok' }));

// mount routes
await (await import('./api/routes.js')).registerRoutes(server);

const port = Number(process.env.PORT || 3001);
server.listen({ port, host: '0.0.0.0' }).catch((err) => { server.log.error(err); process.exit(1); });
EOF

# 路由与控制器（最小）
cat > src/api/routes.ts << 'EOF'
import { FastifyInstance } from 'fastify';
import { generatePromptHandler } from './routes_generate_prompt.js';

export async function registerRoutes(app: FastifyInstance) {
  app.post('/api/generate-prompt', generatePromptHandler);
}
EOF

cat > src/api/routes_generate_prompt.ts << 'EOF'
import { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { buildPrompt } from '../modules/prompt-engine/buildPrompt.js';

const RequestSchema = z.object({
  taskType: z.enum(['generate_sql','explain_sql','optimize_sql']),
  dialect: z.enum(['postgres','mysql']),
  schema: z.record(z.any()).optional(),
  question: z.string().optional(),
  sql: z.string().optional(),
  constraints: z.record(z.any()).optional(),
  context: z.record(z.any()).optional()
});

export async function generatePromptHandler(req: FastifyRequest, reply: FastifyReply) {
  const parse = RequestSchema.safeParse(req.body);
  if (!parse.success) return reply.code(400).send({ code: 'VALIDATION_ERROR', message: 'invalid body', details: parse.error.flatten() });
  const result = buildPrompt(parse.data);
  return reply.send(result);
}
EOF

# 提示词引擎与模板（占位实现）
cat > src/modules/prompt-engine/buildPrompt.ts << 'EOF'
import { getTemplate } from '../templates/templates.js';

export function buildPrompt(input: any) {
  const { taskType, dialect, schema, question, sql, constraints, context } = input;
  const template = getTemplate(taskType, dialect);
  const promptText = template.render({ schema, question, sql, constraints, context });
  return { promptText, promptJson: { taskType, dialect, constraints, context }, budget: { tokens: 0 } };
}
EOF

cat > src/modules/templates/templates.ts << 'EOF'
type TaskType = 'generate_sql' | 'explain_sql' | 'optimize_sql';
type Dialect = 'postgres' | 'mysql';

const BASE = `你是资深数据工程师，目标方言为 {dialect}。请严格遵循以下要求:\n1) 仅生成可执行 SQL，不要输出多余解释；\n2) 基于提供的 Schema 与业务术语进行字段选择与关联；\n3) 避免全表扫描，优先使用已存在索引；\n4) 若涉及时间，默认时区 {timezone}，默认范围 {timeWindow}；\n5) 不进行 DML/DDL 操作；`;

export function getTemplate(task: TaskType, dialect: Dialect) {
  return {
    render(ctx: Record<string, unknown>) {
      const head = BASE.replace('{dialect}', String(dialect))
        .replace('{timezone}', String(ctx?.context?.['timezone'] ?? 'Asia/Shanghai'))
        .replace('{timeWindow}', String(ctx?.constraints?.['timeWindow'] ?? 'last_7d'));
      const body = task === 'generate_sql' ? `问题：${ctx['question'] ?? ''}`
        : task === 'explain_sql' ? `需要解释与审查 SQL：\n${ctx['sql'] ?? ''}`
        : `请给出优化建议并产出优化版 SQL：\n${ctx['sql'] ?? ''}`;
      return `${head}\n\n${body}\n\n相关 Schema（可选/裁剪后）：\n${JSON.stringify(ctx['schema'] ?? {}, null, 2)}`;
    }
  };
}
EOF

# Schema 校验与裁剪占位（后续细化）
cat > src/modules/schema-model/index.ts << 'EOF'
export function pruneSchemaByKeywords(schema: unknown, _keywords: string[]): unknown { return schema; }
EOF

cd ../../
```

3) 前端基础（Vite + React + AntD）

```bash
cd apps/web && npm create vite@latest . -- --template react-ts && \
npm i antd @tanstack/react-query axios && \
npm i -D eslint @typescript-eslint/parser @typescript-eslint/eslint-plugin

# 简化开发代理（vite.config.ts 内添加代理到 3001，具体编辑见任务）
```

前端待编辑要点（在 Cursor 中按文件定位与编辑）：
- `src/main.tsx`：引入 AntD 样式，挂载 React Query。
- `src/App.tsx`：最小向导：上传/粘贴 Schema（`Upload`/`TextArea`）、选择 `taskType`/`dialect`、输入问题/SQL、生成并展示结果（文本/JSON 切换，复制按钮）。
- `vite.config.ts`：配置 devServer 代理到 `http://localhost:3001`。

4) OpenAPI（最小）与运行脚本

```bash
cd apps/server && mkdir -p src/openapi && \
cat > src/openapi/openapi.yaml << 'EOF'
openapi: 3.0.3
info: { title: SQLPromptSmith API, version: 0.1.0 }
paths:
  /healthz:
    get:
      responses: { '200': { description: ok } }
  /api/generate-prompt:
    post:
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                taskType: { type: string, enum: [generate_sql, explain_sql, optimize_sql] }
                dialect: { type: string, enum: [postgres, mysql] }
                schema: { type: object }
                question: { type: string }
                sql: { type: string }
      responses:
        '200': { description: ok }
        '400': { description: validation error }
EOF
cd ../../
```

5) 本地运行与连通性检查

```bash
# 后端
cd apps/server && npm run dev | cat

# 新开终端：前端
cd apps/web && npm run dev | cat

# 接口连通（另一个终端）
curl -s http://localhost:3001/healthz | cat
curl -s -X POST http://localhost:3001/api/generate-prompt \
  -H 'Content-Type: application/json' \
  -d '{"taskType":"generate_sql","dialect":"postgres","schema":{},"question":"统计上周活跃用户"}' | cat
```

6) 质量与校验
- ESLint 最小规则接入，`npm run lint` 通过。
- 基于样例请求的 `curl` 脚本回归。

#### M1 验收清单
- [ ] 三类任务模板可用（生成/解释/优化），Postgres/MySQL 至少一种可工作。
- [ ] `POST /api/generate-prompt` 返回文本与 JSON（占位 budget 字段）。
- [ ] 前端可上传/粘贴 Schema、配置参数并生成与复制提示词。
- [ ] 健康检查通过，错误模型对非法入参返回 400 与细节。

---

### M2（增强）

#### 目标
- 可选直连数据库、元数据采集与样本采样；敏感信息脱敏；版本化与历史；编辑器插件与更多 API。

#### 范围
- 新增模块：`introspection`、`masking`、`jobs`、更多 `api`（jobs 查询、upload-ddl、schema/search）。
- 前端扩展：连接配置页、Schema 选择与采样、脱敏预览、历史与版本页。

#### 可执行步骤（概要）

```bash
# 后端安装驱动与任务队列
cd apps/server && npm i pg mysql2 better-sqlite3 bullmq ioredis && \
npm i -D @types/better-sqlite3

# 新增 API 骨架（示例文件/目录）
mkdir -p src/modules/{introspection,masking,jobs} src/api && touch src/api/{routes_jobs.ts,routes_upload_ddl.ts,routes_schema_search.ts}
```

实现要点：
- `POST /api/introspect` 支持 sync/async，返回 `{ jobId?, schema?, warnings?, requestId }`。
- `GET /api/jobs/:id` 返回 `{ id,status,progress,logs,result? }`。
- `POST /api/upload-ddl` 解析 DDL/JSON/CSV 为统一 Schema。
- `POST /api/schema/search` 执行关键词相关性检索（表/列）。
- 前端向导扩展 5 步流与历史/版本两页。

#### M2 验收清单
- [ ] Postgres/MySQL 元数据采集可用（最小子集），可配置上限与样本行。
- [ ] 敏感列规则与脱敏策略生效；默认脱敏开启。
- [ ] 历史/版本可查看与复用；模板与上下文快照保存。

---

### M3（企业）

#### 目标/范围
- SSO、审计、远程连接代理、云数仓扩展（Snowflake/BigQuery/Redshift）、质量评估与只读沙箱校验。

#### 可执行步骤（概要）
- 接入企业登录（OIDC/SAML），新增审计中间件与日志脱敏强化。
- 远程连接代理与网络策略；云数仓 SDK 适配层。
- 语法与执行计划检查（只读/沙箱），指标采集与报表。

#### M3 验收清单
- [ ] 企业登录可用，审计完整且脱敏合规。
- [ ] 至少一个云数仓端到端打通；质量评估报告产出。

---

### 前后端目录结构（建议）

```
apps/
  server/
    src/
      api/
      modules/
        templates/
        prompt-engine/
        schema-model/
        introspection/        # M2
        masking/              # M2
        jobs/                 # M2
      openapi/
  web/
    src/
packages/
  shared/
docs/
```

---

### NPM 脚本与常用命令

- 后端：
  - 开发：`npm run dev`
  - 构建：`npm run build`
  - 启动：`npm start`
  - Lint：`npm run lint`

- 前端：
  - 开发：`npm run dev`
  - 构建：`npm run build`

---

### 风险与缓解
- 大型 Schema 超出 token 预算：相关性检索 + 分块裁剪 + 增量对话。
- 隐私合规：默认脱敏 + 本地优先 + 不落盘选项。
- 方言差异：模板回测 + 差异知识库 + 单元测试。

---

### 时间预估（可调）
- M1：1.5–2.5 周（核心功能与最小 Web）
- M2：3–5 周（直连/采样/脱敏/历史/插件）
- M3：4–6 周（企业能力与质量评估）

---

### 验收对齐（与需求文档）
- 覆盖 `docs/需求分析.md` 的核心验收与里程碑：M1 核心能力、M2 增强、M3 企业。
- API 与前端交互路径与需求文档一致；安全与错误模型落实在 M1 即建立基线。

