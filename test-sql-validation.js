#!/usr/bin/env node

/**
 * SQL验证功能测试脚本
 * 演示如何使用SQL验证API
 */

const axios = require('axios');

const API_BASE = 'http://localhost:3001';

async function testDialects() {
  console.log('🔍 测试获取支持的数据库方言...');
  try {
    const response = await axios.get(`${API_BASE}/api/sql/dialects`);
    console.log('✅ 支持的数据库类型:');
    response.data.data.forEach(dialect => {
      console.log(`  - ${dialect.name} (${dialect.value}): ${dialect.description}`);
    });
  } catch (error) {
    console.error('❌ 获取数据库类型失败:', error.message);
  }
}

async function testConnection() {
  console.log('\n🔗 测试数据库连接...');
  try {
    const connection = {
      dialect: 'postgres',
      host: 'localhost',
      port: 5432,
      database: 'test',
      username: 'postgres',
      password: 'password',
      ssl: false
    };
    
    const response = await axios.post(`${API_BASE}/api/sql/test-connection`, {
      connection
    });
    
    if (response.data.data.connected) {
      console.log('✅ 数据库连接成功');
    } else {
      console.log('❌ 数据库连接失败');
    }
  } catch (error) {
    console.log('❌ 连接测试失败 (这是正常的，因为没有真实的数据库连接)');
  }
}

async function testSqlValidation() {
  console.log('\n🔍 测试SQL验证...');
  try {
    const validationRequest = {
      sql: 'SELECT * FROM users WHERE id = 1',
      connection: {
        dialect: 'postgres',
        host: 'localhost',
        port: 5432,
        database: 'test',
        username: 'postgres',
        password: 'password',
        ssl: false
      },
      options: {
        readonly: true,
        timeout: 30000,
        maxRows: 100,
        explain: true
      }
    };
    
    const response = await axios.post(`${API_BASE}/api/sql/validate`, validationRequest);
    
    console.log('✅ SQL验证结果:');
    console.log(`  - 语法检查: ${response.data.data.syntaxCheck.valid ? '通过' : '失败'}`);
    console.log(`  - 安全检查: ${response.data.data.securityCheck.isReadOnly ? '只读' : '非只读'}`);
    console.log(`  - 执行时间: ${response.data.data.sampleResults?.executionTime || 0}ms`);
    
    if (response.data.data.syntaxCheck.error) {
      console.log(`  - 语法错误: ${response.data.data.syntaxCheck.error}`);
    }
    
    if (response.data.data.securityCheck.warnings.length > 0) {
      console.log(`  - 安全警告: ${response.data.data.securityCheck.warnings.join(', ')}`);
    }
    
  } catch (error) {
    console.log('❌ SQL验证失败 (这是正常的，因为没有真实的数据库连接)');
    console.log('   错误信息:', error.response?.data?.message || error.message);
  }
}

async function testPromptGeneration() {
  console.log('\n📝 测试提示词生成...');
  try {
    const promptRequest = {
      taskType: 'generate_sql',
      dialect: 'postgres',
      schema: {
        tables: [
          {
            name: 'users',
            columns: [
              { name: 'id', type: 'integer', primaryKey: true },
              { name: 'name', type: 'varchar(100)' },
              { name: 'email', type: 'varchar(255)' },
              { name: 'created_at', type: 'timestamp' }
            ]
          }
        ]
      },
      question: '查询所有用户的姓名和邮箱'
    };
    
    const response = await axios.post(`${API_BASE}/api/generate-prompt`, promptRequest);
    
    console.log('✅ 提示词生成成功:');
    console.log('生成的提示词:');
    console.log(response.data.promptText);
    
  } catch (error) {
    console.error('❌ 提示词生成失败:', error.response?.data?.message || error.message);
  }
}

async function main() {
  console.log('🚀 开始测试SQL验证功能...\n');
  
  await testDialects();
  await testConnection();
  await testSqlValidation();
  await testPromptGeneration();
  
  console.log('\n✨ 测试完成！');
  console.log('\n📖 使用说明:');
  console.log('1. 启动后端服务: cd apps/server && npm run dev');
  console.log('2. 启动前端服务: cd apps/web && npm run dev');
  console.log('3. 访问 http://localhost:5173 使用Web界面');
  console.log('4. 在"SQL验证"标签页中配置数据库连接并验证SQL');
}

main().catch(console.error);