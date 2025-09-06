type TaskType = 'generate_sql' | 'explain_sql' | 'optimize_sql';
type Dialect = 'postgres' | 'mysql';

const BASE = `你是资深数据工程师，目标方言为 {dialect}。请严格遵循以下要求:\n1) 仅生成可执行 SQL，不要输出多余解释；\n2) 基于提供的 Schema 与业务术语进行字段选择与关联；\n3) 避免全表扫描，优先使用已存在索引；\n4) 若涉及时间，默认时区 {timezone}，默认范围 {timeWindow}；\n5) 不进行 DML/DDL 操作；`;

export function getTemplate(task: TaskType, dialect: Dialect) {
  return {
    render(ctx: Record<string, unknown>) {
      const context = ctx.context as Record<string, unknown> || {};
      const constraints = ctx.constraints as Record<string, unknown> || {};
      
      const head = BASE.replace('{dialect}', String(dialect))
        .replace('{timezone}', String(context['timezone'] ?? 'Asia/Shanghai'))
        .replace('{timeWindow}', String(constraints['timeWindow'] ?? 'last_7d'));
      const body = task === 'generate_sql' ? `问题：${ctx['question'] ?? ''}`
        : task === 'explain_sql' ? `需要解释与审查 SQL：\n${ctx['sql'] ?? ''}`
        : `请给出优化建议并产出优化版 SQL：\n${ctx['sql'] ?? ''}`;
      return `${head}\n\n${body}\n\n相关 Schema（可选/裁剪后）：\n${JSON.stringify(ctx['schema'] ?? {}, null, 2)}`;
    }
  };
}