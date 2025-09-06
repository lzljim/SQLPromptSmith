# AI SQL 提示词生成与验证工具

## 项目概述

这是一个集成了AI SQL提示词生成和SQL验证功能的完整工具。用户可以通过AI生成SQL提示词，然后使用内置的验证功能来检查生成的SQL语句的正确性、安全性和性能。

## 主要功能

### 1. AI SQL 提示词生成
- 支持多种任务类型：生成SQL、解释SQL、优化SQL
- 支持多种数据库方言：PostgreSQL、MySQL、SQL Server、SQLite
- 基于Schema上下文生成高质量提示词
- 提供文本和JSON两种输出格式

### 2. SQL验证功能 ⭐ **新增**
- **多数据库支持**: PostgreSQL、MySQL、SQLite、SQL Server
- **语法检查**: 验证SQL语句的语法正确性
- **安全检查**: 检测危险操作，支持只读模式
- **执行计划分析**: 分析查询性能和优化建议
- **样本执行**: 在安全环境下执行SQL并返回样本结果
- **元数据分析**: 分析查询影响的表和复杂度

## 技术架构

### 后端 (Node.js + TypeScript + Fastify)
```
apps/server/
├── src/
│   ├── api/                    # API路由
│   │   ├── routes.ts          # 主路由
│   │   ├── routes_generate_prompt.ts  # 提示词生成API
│   │   └── routes_sql_validation.ts   # SQL验证API
│   ├── modules/
│   │   ├── sql-validation/    # SQL验证模块
│   │   │   ├── types.ts       # 类型定义
│   │   │   ├── security.ts    # 安全检查
│   │   │   └── executor.ts    # SQL执行器
│   │   ├── database/          # 数据库连接管理
│   │   │   └── connection-manager.ts
│   │   ├── templates/         # 提示词模板
│   │   ├── prompt-engine/     # 提示词生成引擎
│   │   └── schema-model/      # Schema模型
│   └── openapi/               # API文档
└── package.json
```

### 前端 (React + TypeScript + Ant Design)
```
apps/web/
├── src/
│   ├── App.tsx                # 主应用组件
│   ├── main.tsx              # 应用入口
│   └── vite.config.ts        # Vite配置
└── package.json
```

## 快速开始

### 1. 安装依赖
```bash
# 安装后端依赖
cd apps/server
npm install

# 安装前端依赖
cd ../web
npm install
```

### 2. 启动服务
```bash
# 启动后端服务 (端口 3001)
cd apps/server
npm run dev

# 启动前端服务 (端口 5173)
cd apps/web
npm run dev
```

### 3. 访问应用
打开浏览器访问 `http://localhost:5173`

## 使用指南

### 提示词生成
1. 在"提示词生成"标签页中配置Schema
2. 选择任务类型和数据库方言
3. 输入问题描述或SQL语句
4. 生成并复制提示词

### SQL验证
1. 切换到"SQL验证"标签页
2. 配置数据库连接信息
3. 设置验证选项（只读模式、超时等）
4. 输入要验证的SQL语句
5. 点击"验证SQL"查看结果

## API接口

### 提示词生成
- `POST /api/generate-prompt` - 生成SQL提示词

### SQL验证
- `POST /api/sql/validate` - 验证SQL语句
- `POST /api/sql/test-connection` - 测试数据库连接
- `GET /api/sql/dialects` - 获取支持的数据库类型

### 系统
- `GET /healthz` - 健康检查

## 安全特性

### SQL验证安全机制
- **只读模式**: 默认启用，只允许SELECT查询
- **危险操作检测**: 自动识别并阻止DROP、DELETE、UPDATE等操作
- **超时控制**: 防止长时间运行的查询（默认30秒）
- **权限限制**: 支持最小权限原则
- **连接管理**: 自动清理数据库连接

### 支持的危险操作检测
- DDL操作：DROP、CREATE、ALTER、TRUNCATE
- DML操作：DELETE、UPDATE、INSERT
- 系统操作：GRANT、REVOKE、EXEC
- 文件操作：LOAD DATA、INTO OUTFILE

## 验证结果展示

### 概览统计
- 语法检查状态
- 安全检查状态
- 执行时间

### 详细报告
- **语法错误**: 显示具体的语法错误信息
- **安全警告**: 列出潜在的安全风险
- **执行计划**: 展示查询的执行计划和性能分析
- **样本数据**: 以表格形式展示查询结果
- **元数据**: 显示影响的表、复杂度等信息

## 支持的数据库

| 数据库 | 语法检查 | 执行计划 | 样本执行 | 安全检查 |
|--------|----------|----------|----------|----------|
| PostgreSQL | ✅ | ✅ | ✅ | ✅ |
| MySQL | ✅ | ✅ | ✅ | ✅ |
| SQLite | ✅ | ✅ | ✅ | ✅ |
| SQL Server | ✅ | ✅ | ✅ | ✅ |

## 配置选项

### 数据库连接
- 主机地址和端口
- 数据库名称
- 用户名和密码
- SSL选项

### 验证选项
- 只读模式开关
- 超时时间设置（1-300秒）
- 最大返回行数（1-10000行）
- 执行计划生成开关

## 开发说明

### 添加新的数据库支持
1. 在 `connection-manager.ts` 中添加连接逻辑
2. 在 `executor.ts` 中添加语法检查方法
3. 更新类型定义和API文档

### 扩展安全检查规则
1. 在 `security.ts` 中添加新的检测模式
2. 更新 `DANGEROUS_PATTERNS` 数组
3. 添加相应的警告信息

### 自定义验证选项
1. 在 `types.ts` 中定义新的选项类型
2. 在 `executor.ts` 中实现相应的逻辑
3. 更新前端界面和API接口

## 故障排除

### 常见问题
1. **数据库连接失败**: 检查连接配置和网络
2. **SQL验证超时**: 调整超时设置或优化SQL
3. **权限不足**: 确保使用只读数据库用户
4. **语法错误**: 检查SQL语句和数据库方言

### 日志查看
- 后端日志：控制台输出
- 前端日志：浏览器开发者工具
- API错误：查看响应状态码和错误信息

## 贡献指南

1. Fork 项目
2. 创建功能分支
3. 提交更改
4. 创建 Pull Request

## 许可证

MIT License

## 联系方式

如有问题或建议，请创建 Issue 或联系开发团队。

---

**注意**: 这是一个演示项目，请勿在生产环境中使用。SQL验证功能需要在安全的网络环境中使用，并确保数据库连接的安全性。