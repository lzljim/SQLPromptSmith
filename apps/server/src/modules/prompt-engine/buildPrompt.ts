import { getTemplate } from '../templates/templates.js';

export function buildPrompt(input: any) {
  const { taskType, dialect, schema, question, sql, constraints, context } = input;
  const template = getTemplate(taskType, dialect);
  const promptText = template.render({ schema, question, sql, constraints, context });
  return { promptText, promptJson: { taskType, dialect, constraints, context }, budget: { tokens: 0 } };
}