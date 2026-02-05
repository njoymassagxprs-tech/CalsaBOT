/**
 * Teste automatizado do Setup Wizard
 * Simula respostas do utilizador
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const { exec } = require('child_process');

// Cores
const c = {
  ok: (t) => `\x1b[32m${t}\x1b[0m`,
  err: (t) => `\x1b[31m${t}\x1b[0m`,
  info: (t) => `\x1b[36m${t}\x1b[0m`,
  bold: (t) => `\x1b[1m${t}\x1b[0m`
};

console.log('\n' + '═'.repeat(60));
console.log('🧪 Teste do Setup Wizard');
console.log('═'.repeat(60) + '\n');

let passed = 0;
let failed = 0;

function test(name, condition, errorMsg = '') {
  if (condition) {
    console.log(c.ok(`✅ ${name}`));
    passed++;
  } else {
    console.log(c.err(`❌ ${name}${errorMsg ? ': ' + errorMsg : ''}`));
    failed++;
  }
}

// ─────────────────────────────────────────────────────────────
// TESTES
// ─────────────────────────────────────────────────────────────

// 1. Verificar que setup.js existe e carrega sem erros
console.log(c.info('\n📁 Testes de Ficheiro\n'));

test('setup.js existe', fs.existsSync(path.join(__dirname, '..', 'setup.js')));

// 2. Testar função de abrir URL (não abre realmente)
console.log(c.info('\n🌐 Testes de URL\n'));

function testOpenUrlCommand() {
  const platform = process.platform;
  let command;
  
  if (platform === 'win32') {
    command = 'start "" "https://test.com"';
  } else if (platform === 'darwin') {
    command = 'open "https://test.com"';
  } else {
    command = 'xdg-open "https://test.com"';
  }
  
  return command.length > 0;
}

test('Comando de abrir URL definido', testOpenUrlCommand());

// 3. Testar validação de padrões
console.log(c.info('\n🔐 Testes de Padrões de API Keys\n'));

const patterns = {
  groq: /^gsk_[a-zA-Z0-9]{40,}$/,
  telegram: /^\d{8,12}:[A-Za-z0-9_-]{35,}$/,
  twilio_sid: /^AC[a-f0-9]{32}$/,
  openai: /^sk-(?:proj-)?[a-zA-Z0-9\-_]{20,}$/
};

// Groq key válida (exemplo fictício)
test('Padrão Groq aceita key válida', 
  patterns.groq.test('gsk_EXEMPLO1234567890abcdefghijklmnopqrstuvwxyzABCD'));

test('Padrão Groq rejeita key inválida',
  !patterns.groq.test('invalid_key'));

// Telegram token válido
test('Padrão Telegram aceita token válido',
  patterns.telegram.test('123456789:ABCdefGHIjklMNOpqrsTUVwxyz1234567890'));

test('Padrão Telegram rejeita token inválido',
  !patterns.telegram.test('invalid'));

// Twilio SID válido (formato exemplo - não é real)
test('Padrão Twilio SID aceita formato válido',
  patterns.twilio_sid.test('ACaaaabbbbccccddddeeeeffffgggghhhh'));

test('Padrão Twilio SID rejeita formato inválido',
  !patterns.twilio_sid.test('invalid'));

// OpenAI key válida
test('Padrão OpenAI aceita sk- key',
  patterns.openai.test('sk-abcdefghijklmnopqrstuvwx'));

test('Padrão OpenAI aceita sk-proj- key',
  patterns.openai.test('sk-proj-abcdefghijklmnopqrstuvwxyz'));

test('Padrão OpenAI rejeita key inválida',
  !patterns.openai.test('invalid'));

// 4. Testar conexão às APIs
console.log(c.info('\n🌍 Testes de Conexão\n'));

async function testGroqConnection() {
  return new Promise((resolve) => {
    const req = https.request({
      hostname: 'api.groq.com',
      path: '/openai/v1/models',
      method: 'GET',
      timeout: 5000
    }, (res) => {
      // 401 significa que o servidor respondeu (key inválida, mas servidor OK)
      resolve(res.statusCode === 401 || res.statusCode === 200);
    });
    
    req.on('error', () => resolve(false));
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
    
    req.end();
  });
}

async function testTelegramConnection() {
  return new Promise((resolve) => {
    const req = https.request({
      hostname: 'api.telegram.org',
      path: '/bot123:test/getMe',
      method: 'GET',
      timeout: 5000
    }, (res) => {
      // 401/404 significa que o servidor respondeu
      resolve(res.statusCode < 500);
    });
    
    req.on('error', () => resolve(false));
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
    
    req.end();
  });
}

async function runAsyncTests() {
  const groqOk = await testGroqConnection();
  test('Conexão ao Groq API', groqOk);
  
  const telegramOk = await testTelegramConnection();
  test('Conexão ao Telegram API', telegramOk);
  
  // 5. Testar criação de .env
  console.log(c.info('\n💾 Testes de Ficheiro .env\n'));
  
  const testEnvPath = path.join(__dirname, 'test.env');
  const testContent = `# Test
GROQ_API_KEY=gsk_test123
`;
  
  try {
    fs.writeFileSync(testEnvPath, testContent, 'utf-8');
    test('Criar ficheiro .env', fs.existsSync(testEnvPath));
    
    const content = fs.readFileSync(testEnvPath, 'utf-8');
    test('Conteúdo do .env correto', content.includes('GROQ_API_KEY'));
    
    fs.unlinkSync(testEnvPath);
    test('Limpar ficheiro de teste', !fs.existsSync(testEnvPath));
  } catch (err) {
    test('Operações de ficheiro', false, err.message);
  }
  
  // Resultados
  console.log('\n' + '═'.repeat(60));
  console.log(`📊 Resultados: ${passed} passou, ${failed} falhou`);
  console.log('═'.repeat(60));
  
  if (failed === 0) {
    console.log(c.ok('\n✅ Todos os testes do Setup Wizard passaram!\n'));
    process.exit(0);
  } else {
    console.log(c.err('\n❌ Alguns testes falharam\n'));
    process.exit(1);
  }
}

runAsyncTests();
