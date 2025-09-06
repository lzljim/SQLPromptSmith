import React, { useState } from 'react';
import { Layout, Card, Steps, Upload, Input, Select, Button, Space, Typography, Divider, message } from 'antd';
import { UploadOutlined, CopyOutlined } from '@ant-design/icons';
import { useMutation } from '@tanstack/react-query';
import axios from 'axios';

const { Header, Content } = Layout;
const { TextArea } = Input;
const { Option } = Select;
const { Title, Text, Paragraph } = Typography;

interface GeneratePromptRequest {
  taskType: 'generate_sql' | 'explain_sql' | 'optimize_sql';
  dialect: 'postgres' | 'mysql';
  schema?: Record<string, any>;
  question?: string;
  sql?: string;
  constraints?: Record<string, any>;
  context?: Record<string, any>;
}

interface GeneratePromptResponse {
  promptText: string;
  promptJson: Record<string, any>;
  budget: { tokens: number };
}

const App: React.FC = () => {
  const [currentStep, setCurrentStep] = useState(0);
  const [schemaData, setSchemaData] = useState<Record<string, any>>({});
  const [taskType, setTaskType] = useState<'generate_sql' | 'explain_sql' | 'optimize_sql'>('generate_sql');
  const [dialect, setDialect] = useState<'postgres' | 'mysql'>('postgres');
  const [question, setQuestion] = useState('');
  const [sql, setSql] = useState('');
  const [result, setResult] = useState<GeneratePromptResponse | null>(null);

  const generatePromptMutation = useMutation({
    mutationFn: async (data: GeneratePromptRequest) => {
      const response = await axios.post('/api/generate-prompt', data);
      return response.data;
    },
    onSuccess: (data) => {
      setResult(data);
      setCurrentStep(2);
      message.success('提示词生成成功！');
    },
    onError: (error: any) => {
      message.error(`生成失败: ${error.response?.data?.message || error.message}`);
    },
  });

  const handleSchemaUpload = (file: any) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const parsed = JSON.parse(content);
        setSchemaData(parsed);
        message.success('Schema 文件上传成功！');
      } catch (error) {
        message.error('Schema 文件格式错误，请上传有效的 JSON 文件');
      }
    };
    reader.readAsText(file);
    return false; // 阻止自动上传
  };

  const handleGenerate = () => {
    const requestData: GeneratePromptRequest = {
      taskType,
      dialect,
      schema: schemaData,
      ...(taskType === 'generate_sql' ? { question } : { sql }),
    };
    generatePromptMutation.mutate(requestData);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      message.success('已复制到剪贴板！');
    });
  };

  const steps = [
    {
      title: 'Schema 配置',
      content: (
        <Card title="数据库 Schema 配置">
          <Space direction="vertical" style={{ width: '100%' }}>
            <div>
              <Text strong>上传 Schema 文件（JSON 格式）</Text>
              <Upload
                beforeUpload={handleSchemaUpload}
                accept=".json"
                showUploadList={false}
                style={{ marginTop: 8 }}
              >
                <Button icon={<UploadOutlined />}>选择文件</Button>
              </Upload>
            </div>
            <div>
              <Text strong>或直接粘贴 Schema JSON</Text>
              <TextArea
                placeholder="请粘贴 Schema JSON 数据..."
                rows={6}
                value={JSON.stringify(schemaData, null, 2)}
                onChange={(e) => {
                  try {
                    const parsed = JSON.parse(e.target.value);
                    setSchemaData(parsed);
                  } catch {
                    // 忽略解析错误，允许用户继续编辑
                  }
                }}
              />
            </div>
          </Space>
        </Card>
      ),
    },
    {
      title: '任务配置',
      content: (
        <Card title="任务配置">
          <Space direction="vertical" style={{ width: '100%' }}>
            <div>
              <Text strong>任务类型</Text>
              <Select
                value={taskType}
                onChange={setTaskType}
                style={{ width: '100%', marginTop: 8 }}
              >
                <Option value="generate_sql">生成 SQL</Option>
                <Option value="explain_sql">解释 SQL</Option>
                <Option value="optimize_sql">优化 SQL</Option>
              </Select>
            </div>
            <div>
              <Text strong>数据库方言</Text>
              <Select
                value={dialect}
                onChange={setDialect}
                style={{ width: '100%', marginTop: 8 }}
              >
                <Option value="postgres">PostgreSQL</Option>
                <Option value="mysql">MySQL</Option>
              </Select>
            </div>
            {taskType === 'generate_sql' ? (
              <div>
                <Text strong>问题描述</Text>
                <TextArea
                  placeholder="请描述您需要生成的 SQL 查询..."
                  rows={4}
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  style={{ marginTop: 8 }}
                />
              </div>
            ) : (
              <div>
                <Text strong>SQL 语句</Text>
                <TextArea
                  placeholder="请粘贴需要解释或优化的 SQL 语句..."
                  rows={6}
                  value={sql}
                  onChange={(e) => setSql(e.target.value)}
                  style={{ marginTop: 8 }}
                />
              </div>
            )}
            <Button
              type="primary"
              onClick={handleGenerate}
              loading={generatePromptMutation.isPending}
              size="large"
            >
              生成提示词
            </Button>
          </Space>
        </Card>
      ),
    },
    {
      title: '结果展示',
      content: (
        <Card title="生成的提示词">
          {result && (
            <Space direction="vertical" style={{ width: '100%' }}>
              <div>
                <Space>
                  <Text strong>文本格式</Text>
                  <Button
                    icon={<CopyOutlined />}
                    onClick={() => copyToClipboard(result.promptText)}
                  >
                    复制
                  </Button>
                </Space>
                <Paragraph
                  style={{
                    marginTop: 8,
                    padding: 12,
                    backgroundColor: '#f5f5f5',
                    borderRadius: 6,
                    whiteSpace: 'pre-wrap',
                    fontFamily: 'monospace',
                  }}
                >
                  {result.promptText}
                </Paragraph>
              </div>
              <Divider />
              <div>
                <Space>
                  <Text strong>JSON 格式</Text>
                  <Button
                    icon={<CopyOutlined />}
                    onClick={() => copyToClipboard(JSON.stringify(result.promptJson, null, 2))}
                  >
                    复制
                  </Button>
                </Space>
                <Paragraph
                  style={{
                    marginTop: 8,
                    padding: 12,
                    backgroundColor: '#f5f5f5',
                    borderRadius: 6,
                    whiteSpace: 'pre-wrap',
                    fontFamily: 'monospace',
                  }}
                >
                  {JSON.stringify(result.promptJson, null, 2)}
                </Paragraph>
              </div>
              <div>
                <Text type="secondary">Token 预算: {result.budget.tokens}</Text>
              </div>
            </Space>
          )}
        </Card>
      ),
    },
  ];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{ background: '#fff', padding: '0 24px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
        <Title level={3} style={{ margin: 0, lineHeight: '64px' }}>
          AI SQL 提示词生成工具
        </Title>
      </Header>
      <Content style={{ padding: '24px' }}>
        <Card>
          <Steps current={currentStep} items={steps.map(s => ({ title: s.title }))} />
          <div style={{ marginTop: 24 }}>
            {steps[currentStep].content}
          </div>
          <div style={{ marginTop: 24, textAlign: 'right' }}>
            <Space>
              {currentStep > 0 && (
                <Button onClick={() => setCurrentStep(currentStep - 1)}>
                  上一步
                </Button>
              )}
              {currentStep < steps.length - 1 && (
                <Button type="primary" onClick={() => setCurrentStep(currentStep + 1)}>
                  下一步
                </Button>
              )}
            </Space>
          </div>
        </Card>
      </Content>
    </Layout>
  );
};

export default App;