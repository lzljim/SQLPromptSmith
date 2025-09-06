import React, { useState } from 'react';
import { Layout, Card, Steps, Upload, Input, Select, Button, Space, Typography, Divider, message, Tabs, Table, Tag, Alert, Collapse, Switch, InputNumber, Row, Col, Statistic } from 'antd';
import { UploadOutlined, CopyOutlined, DatabaseOutlined, CheckCircleOutlined, ExclamationCircleOutlined, ClockCircleOutlined, SecurityScanOutlined } from '@ant-design/icons';
import { useMutation, useQuery } from '@tanstack/react-query';
import axios from 'axios';

const { Header, Content } = Layout;
const { TextArea } = Input;
const { Option } = Select;
const { Title, Text, Paragraph } = Typography;
const { TabPane } = Tabs;
const { Panel } = Collapse;

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

interface DatabaseConnection {
  dialect: 'postgres' | 'mysql' | 'sqlite' | 'mssql';
  host?: string;
  port?: number;
  database: string;
  username?: string;
  password?: string;
  ssl?: boolean;
}

interface SqlValidationRequest {
  sql: string;
  connection: DatabaseConnection;
  options?: {
    readonly?: boolean;
    timeout?: number;
    maxRows?: number;
    explain?: boolean;
  };
}

interface SqlValidationResponse {
  success: boolean;
  data: {
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
  };
}

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState('prompt');
  const [currentStep, setCurrentStep] = useState(0);
  const [schemaData, setSchemaData] = useState<Record<string, any>>({});
  const [taskType, setTaskType] = useState<'generate_sql' | 'explain_sql' | 'optimize_sql'>('generate_sql');
  const [dialect, setDialect] = useState<'postgres' | 'mysql'>('postgres');
  const [question, setQuestion] = useState('');
  const [sql, setSql] = useState('');
  const [result, setResult] = useState<GeneratePromptResponse | null>(null);
  
  // SQL验证相关状态
  const [validationSql, setValidationSql] = useState('');
  const [dbConnection, setDbConnection] = useState<DatabaseConnection>({
    dialect: 'postgres',
    host: 'localhost',
    port: 5432,
    database: '',
    username: '',
    password: '',
    ssl: false
  });
  const [validationOptions, setValidationOptions] = useState({
    readonly: true,
    timeout: 30000,
    maxRows: 1000,
    explain: true
  });
  const [validationResult, setValidationResult] = useState<SqlValidationResponse | null>(null);

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

  // 获取支持的数据库方言
  const { data: dialectsData } = useQuery({
    queryKey: ['dialects'],
    queryFn: async () => {
      const response = await axios.get('/api/sql/dialects');
      return response.data;
    }
  });

  // SQL验证mutation
  const validateSqlMutation = useMutation({
    mutationFn: async (data: SqlValidationRequest) => {
      const response = await axios.post('/api/sql/validate', data);
      return response.data;
    },
    onSuccess: (data) => {
      setValidationResult(data);
      message.success('SQL验证完成！');
    },
    onError: (error: any) => {
      message.error(`验证失败: ${error.response?.data?.message || error.message}`);
    },
  });

  // 测试数据库连接mutation
  const testConnectionMutation = useMutation({
    mutationFn: async (connection: DatabaseConnection) => {
      const response = await axios.post('/api/sql/test-connection', { connection });
      return response.data;
    },
    onSuccess: (data) => {
      if (data.data.connected) {
        message.success('数据库连接成功！');
      } else {
        message.error('数据库连接失败！');
      }
    },
    onError: (error: any) => {
      message.error(`连接测试失败: ${error.response?.data?.message || error.message}`);
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

  // SQL验证相关处理函数
  const handleValidateSql = () => {
    if (!validationSql.trim()) {
      message.warning('请输入要验证的SQL语句');
      return;
    }
    if (!dbConnection.database) {
      message.warning('请输入数据库名称');
      return;
    }

    validateSqlMutation.mutate({
      sql: validationSql,
      connection: dbConnection,
      options: validationOptions
    });
  };

  const handleTestConnection = () => {
    if (!dbConnection.database) {
      message.warning('请输入数据库名称');
      return;
    }

    testConnectionMutation.mutate(dbConnection);
  };

  const handleDbConnectionChange = (field: keyof DatabaseConnection, value: any) => {
    setDbConnection(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleValidationOptionsChange = (field: keyof typeof validationOptions, value: any) => {
    setValidationOptions(prev => ({
      ...prev,
      [field]: value
    }));
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

  // SQL验证结果展示组件
  const renderValidationResult = () => {
    if (!validationResult) return null;

    const { data } = validationResult;
    const { syntaxCheck, executionPlan, sampleResults, securityCheck, metadata } = data;

    return (
      <div style={{ marginTop: 16 }}>
        <Row gutter={16}>
          <Col span={8}>
            <Card size="small">
              <Statistic
                title="语法检查"
                value={syntaxCheck.valid ? '通过' : '失败'}
                prefix={syntaxCheck.valid ? <CheckCircleOutlined style={{ color: '#52c41a' }} /> : <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />}
              />
            </Card>
          </Col>
          <Col span={8}>
            <Card size="small">
              <Statistic
                title="安全检查"
                value={securityCheck.isReadOnly ? '只读' : '非只读'}
                prefix={<SecurityScanOutlined style={{ color: securityCheck.isReadOnly ? '#52c41a' : '#faad14' }} />}
              />
            </Card>
          </Col>
          <Col span={8}>
            <Card size="small">
              <Statistic
                title="执行时间"
                value={sampleResults?.executionTime || 0}
                suffix="ms"
                prefix={<ClockCircleOutlined />}
              />
            </Card>
          </Col>
        </Row>

        <Collapse style={{ marginTop: 16 }}>
          {!syntaxCheck.valid && (
            <Panel header="语法错误" key="syntax-error">
              <Alert
                type="error"
                message="SQL语法错误"
                description={syntaxCheck.error}
                showIcon
              />
            </Panel>
          )}

          {securityCheck.warnings.length > 0 && (
            <Panel header="安全警告" key="security-warnings">
              <Alert
                type="warning"
                message="发现安全警告"
                description={
                  <ul>
                    {securityCheck.warnings.map((warning, index) => (
                      <li key={index}>{warning}</li>
                    ))}
                  </ul>
                }
                showIcon
              />
            </Panel>
          )}

          {securityCheck.blockedOperations.length > 0 && (
            <Panel header="被阻止的操作" key="blocked-operations">
              <Alert
                type="error"
                message="检测到危险操作"
                description={
                  <ul>
                    {securityCheck.blockedOperations.map((op, index) => (
                      <li key={index}>{op}</li>
                    ))}
                  </ul>
                }
                showIcon
              />
            </Panel>
          )}

          {executionPlan && (
            <Panel header="执行计划" key="execution-plan">
              <pre style={{ background: '#f5f5f5', padding: 12, borderRadius: 4 }}>
                {JSON.stringify(executionPlan.plan, null, 2)}
              </pre>
              {executionPlan.warnings && executionPlan.warnings.length > 0 && (
                <Alert
                  type="warning"
                  message="执行计划警告"
                  description={
                    <ul>
                      {executionPlan.warnings.map((warning, index) => (
                        <li key={index}>{warning}</li>
                      ))}
                    </ul>
                  }
                  style={{ marginTop: 8 }}
                />
              )}
            </Panel>
          )}

          {sampleResults && (
            <Panel header="样本结果" key="sample-results">
              <Table
                dataSource={sampleResults.rows.map((row, index) => ({ key: index, ...row }))}
                columns={sampleResults.columns.map(col => ({
                  title: col.name,
                  dataIndex: col.name,
                  key: col.name,
                  render: (value: any) => String(value)
                }))}
                pagination={false}
                size="small"
                scroll={{ x: true }}
              />
            </Panel>
          )}

          {metadata && (
            <Panel header="元数据信息" key="metadata">
              <Row gutter={16}>
                <Col span={8}>
                  <Text strong>影响的表:</Text>
                  <div>
                    {metadata.affectedTables.map(table => (
                      <Tag key={table} style={{ margin: 2 }}>{table}</Tag>
                    ))}
                  </div>
                </Col>
                <Col span={8}>
                  <Text strong>复杂度:</Text>
                  <Tag color={metadata.complexity === 'low' ? 'green' : metadata.complexity === 'medium' ? 'orange' : 'red'}>
                    {metadata.complexity}
                  </Tag>
                </Col>
                <Col span={8}>
                  <Text strong>预估行数:</Text>
                  <Text>{metadata.estimatedRows}</Text>
                </Col>
              </Row>
            </Panel>
          )}
        </Collapse>
      </div>
    );
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{ background: '#fff', padding: '0 24px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
        <Title level={3} style={{ margin: 0, lineHeight: '64px' }}>
          AI SQL 提示词生成与验证工具
        </Title>
      </Header>
      <Content style={{ padding: '24px' }}>
        <Card>
          <Tabs activeKey={activeTab} onChange={setActiveTab}>
            <TabPane tab="提示词生成" key="prompt">
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
            </TabPane>
            
            <TabPane tab="SQL验证" key="validation">
              <Space direction="vertical" style={{ width: '100%' }}>
                <Card title="数据库连接配置" size="small">
                  <Row gutter={16}>
                    <Col span={8}>
                      <Text strong>数据库类型</Text>
                      <Select
                        value={dbConnection.dialect}
                        onChange={(value) => handleDbConnectionChange('dialect', value)}
                        style={{ width: '100%', marginTop: 8 }}
                      >
                        {dialectsData?.data?.map((dialect: any) => (
                          <Option key={dialect.value} value={dialect.value}>
                            {dialect.name}
                          </Option>
                        ))}
                      </Select>
                    </Col>
                    <Col span={8}>
                      <Text strong>主机地址</Text>
                      <Input
                        value={dbConnection.host}
                        onChange={(e) => handleDbConnectionChange('host', e.target.value)}
                        placeholder="localhost"
                        style={{ marginTop: 8 }}
                      />
                    </Col>
                    <Col span={8}>
                      <Text strong>端口</Text>
                      <InputNumber
                        value={dbConnection.port}
                        onChange={(value) => handleDbConnectionChange('port', value)}
                        style={{ width: '100%', marginTop: 8 }}
                      />
                    </Col>
                  </Row>
                  <Row gutter={16} style={{ marginTop: 16 }}>
                    <Col span={8}>
                      <Text strong>数据库名</Text>
                      <Input
                        value={dbConnection.database}
                        onChange={(e) => handleDbConnectionChange('database', e.target.value)}
                        placeholder="数据库名称"
                        style={{ marginTop: 8 }}
                      />
                    </Col>
                    <Col span={8}>
                      <Text strong>用户名</Text>
                      <Input
                        value={dbConnection.username}
                        onChange={(e) => handleDbConnectionChange('username', e.target.value)}
                        placeholder="用户名"
                        style={{ marginTop: 8 }}
                      />
                    </Col>
                    <Col span={8}>
                      <Text strong>密码</Text>
                      <Input.Password
                        value={dbConnection.password}
                        onChange={(e) => handleDbConnectionChange('password', e.target.value)}
                        placeholder="密码"
                        style={{ marginTop: 8 }}
                      />
                    </Col>
                  </Row>
                  <Row style={{ marginTop: 16 }}>
                    <Col span={8}>
                      <Space>
                        <Switch
                          checked={dbConnection.ssl}
                          onChange={(checked) => handleDbConnectionChange('ssl', checked)}
                        />
                        <Text>使用SSL</Text>
                      </Space>
                    </Col>
                    <Col span={16}>
                      <Space>
                        <Button
                          onClick={handleTestConnection}
                          loading={testConnectionMutation.isPending}
                          icon={<DatabaseOutlined />}
                        >
                          测试连接
                        </Button>
                      </Space>
                    </Col>
                  </Row>
                </Card>

                <Card title="验证选项" size="small">
                  <Row gutter={16}>
                    <Col span={6}>
                      <Space>
                        <Switch
                          checked={validationOptions.readonly}
                          onChange={(checked) => handleValidationOptionsChange('readonly', checked)}
                        />
                        <Text>只读模式</Text>
                      </Space>
                    </Col>
                    <Col span={6}>
                      <Space>
                        <Switch
                          checked={validationOptions.explain}
                          onChange={(checked) => handleValidationOptionsChange('explain', checked)}
                        />
                        <Text>生成执行计划</Text>
                      </Space>
                    </Col>
                    <Col span={6}>
                      <Text strong>超时时间(ms)</Text>
                      <InputNumber
                        value={validationOptions.timeout}
                        onChange={(value) => handleValidationOptionsChange('timeout', value)}
                        min={1000}
                        max={300000}
                        style={{ width: '100%', marginTop: 8 }}
                      />
                    </Col>
                    <Col span={6}>
                      <Text strong>最大行数</Text>
                      <InputNumber
                        value={validationOptions.maxRows}
                        onChange={(value) => handleValidationOptionsChange('maxRows', value)}
                        min={1}
                        max={10000}
                        style={{ width: '100%', marginTop: 8 }}
                      />
                    </Col>
                  </Row>
                </Card>

                <Card title="SQL语句" size="small">
                  <TextArea
                    value={validationSql}
                    onChange={(e) => setValidationSql(e.target.value)}
                    placeholder="请输入要验证的SQL语句..."
                    rows={8}
                    style={{ fontFamily: 'monospace' }}
                  />
                  <div style={{ marginTop: 16, textAlign: 'right' }}>
                    <Button
                      type="primary"
                      onClick={handleValidateSql}
                      loading={validateSqlMutation.isPending}
                      icon={<CheckCircleOutlined />}
                      size="large"
                    >
                      验证SQL
                    </Button>
                  </div>
                </Card>

                {renderValidationResult()}
              </Space>
            </TabPane>
          </Tabs>
        </Card>
      </Content>
    </Layout>
  );
};

export default App;