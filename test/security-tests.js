/**
 * CalsaBOT - Suite de Testes de Segurança
 * 
 * Executa: node test/security-tests.js
 */

require('dotenv').config();
const security = require('../orchestrator/securityAdvanced');

// Cores para output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

function log(type, message) {
  const icons = {
    pass: `${colors.green}✅`,
    fail: `${colors.red}❌`,
    warn: `${colors.yellow}⚠️`,
    info: `${colors.blue}ℹ️`
  };
  console.log(`${icons[type] || ''} ${message}${colors.reset}`);
}

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    log('pass', `${name}`);
    passed++;
  } catch (err) {
    log('fail', `${name}: ${err.message}`);
    failed++;
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message || 'Assertion failed');
}

console.log('\n' + '═'.repeat(60));
console.log('🧪 CalsaBOT - Testes de Segurança');
console.log('═'.repeat(60) + '\n');

// ═══════════════════════════════════════════════════════════
// TESTES DE VALIDAÇÃO DE CAMINHOS
// ═══════════════════════════════════════════════════════════

console.log('📁 Testes de Caminhos\n');

test('Bloqueia pasta Windows', () => {
  assert(security.isBlockedPath('C:\\Windows\\System32'), 'Deveria bloquear Windows');
});

test('Bloqueia pasta Program Files', () => {
  assert(security.isBlockedPath('C:\\Program Files\\teste'), 'Deveria bloquear Program Files');
});

test('Permite pasta do projeto', () => {
  assert(!security.isBlockedPath('./Documentos'), 'Deveria permitir Documentos');
});

test('Permite pasta do utilizador', () => {
  assert(!security.isBlockedPath('C:\\Users\\diabo\\Desktop'), 'Deveria permitir Desktop');
});

test('Deteta ficheiro .env como sensível', () => {
  assert(security.isSensitiveFile('.env'), 'Deveria marcar .env como sensível');
});

test('Deteta credentials como sensível', () => {
  assert(security.isSensitiveFile('config/credentials.json'), 'Deveria marcar credentials como sensível');
});

test('Ficheiro normal não é sensível', () => {
  assert(!security.isSensitiveFile('documento.txt'), 'Não deveria marcar .txt como sensível');
});

// ═══════════════════════════════════════════════════════════
// TESTES DE DETEÇÃO DE DADOS SENSÍVEIS
// ═══════════════════════════════════════════════════════════

console.log('\n🔐 Testes de Dados Sensíveis\n');

test('Deteta API key Groq', () => {
  const result = security.detectSensitiveData('GROQ_API_KEY=gsk_EXEMPLO1234567890abcdefghijklmnopqrstuvwxyzABCD');
  assert(result.hasSensitive, 'Deveria detetar chave Groq');
});

test('Deteta API key OpenAI', () => {
  const result = security.detectSensitiveData('sk-proj-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx');
  assert(result.hasSensitive, 'Deveria detetar chave OpenAI');
});

test('Deteta password', () => {
  const result = security.detectSensitiveData('password=minhasenha123');
  assert(result.hasSensitive, 'Deveria detetar password');
});

test('Deteta cartão de crédito', () => {
  const result = security.detectSensitiveData('4111 1111 1111 1111');
  assert(result.hasSensitive, 'Deveria detetar número de cartão');
});

test('Deteta IBAN', () => {
  const result = security.detectSensitiveData('PT50000201231234567890154');
  assert(result.hasSensitive, 'Deveria detetar IBAN');
});

test('Deteta telefone português', () => {
  const result = security.detectSensitiveData('+351912345678');
  assert(result.hasSensitive, 'Deveria detetar telefone PT');
});

test('Deteta email', () => {
  const result = security.detectSensitiveData('teste@email.com');
  assert(result.hasSensitive, 'Deveria detetar email');
});

test('Texto normal não é sensível', () => {
  const result = security.detectSensitiveData('Olá, como estás? O tempo está bom hoje.');
  assert(!result.hasSensitive, 'Não deveria marcar texto normal');
});

// ═══════════════════════════════════════════════════════════
// TESTES DE MASCARAMENTO
// ═══════════════════════════════════════════════════════════

console.log('\n🎭 Testes de Mascaramento\n');

test('Mascara API key', () => {
  const masked = security.maskSensitiveData('API_KEY=gsk_EXEMPLO1234567890abcdefghijklmnopqrstuvwxyzABCD');
  assert(!masked.includes('gsk_EXEMPLO1234'), 'Deveria mascarar a chave');
  assert(masked.includes('****'), 'Deveria conter asteriscos');
});

test('Mascara password', () => {
  const masked = security.maskSensitiveData('password=supersecreta123');
  assert(!masked.includes('supersecreta'), 'Deveria mascarar password');
});

test('Mascara email parcialmente', () => {
  const masked = security.maskSensitiveData('Email: teste@email.com');
  assert(masked.includes('****'), 'Deveria conter mascaramento');
});

test('Texto normal não é alterado', () => {
  const original = 'Este é um texto normal sem dados sensíveis';
  const masked = security.maskSensitiveData(original);
  assert(masked === original, 'Não deveria alterar texto normal');
});

// ═══════════════════════════════════════════════════════════
// TESTES DE RATE LIMITING
// ═══════════════════════════════════════════════════════════

console.log('\n⏱️ Testes de Rate Limiting\n');

test('Utilizador novo não está limitado', () => {
  assert(!security.isRateLimited('test-user-new'), 'Utilizador novo não deveria estar limitado');
});

test('Permite execuções até ao limite', () => {
  const testUser = 'test-rate-' + Date.now();
  for (let i = 0; i < 5; i++) {
    security.recordExecution(testUser);
  }
  assert(security.isRateLimited(testUser), 'Deveria estar limitado após 5 execuções');
});

test('Conta execuções restantes corretamente', () => {
  const testUser = 'test-remaining-' + Date.now();
  security.recordExecution(testUser);
  security.recordExecution(testUser);
  const remaining = security.getRemainingExecutions(testUser);
  assert(remaining === 3, `Deveria ter 3 restantes, tem ${remaining}`);
});

// ═══════════════════════════════════════════════════════════
// TESTES DE VALIDAÇÃO DE CAMINHOS COMPLETA
// ═══════════════════════════════════════════════════════════

console.log('\n📋 Testes de Validação Completa\n');

test('Valida leitura de caminho normal', () => {
  const result = security.validatePath('./Documentos/teste.txt', 'read');
  assert(result.allowed, 'Deveria permitir leitura');
});

test('Bloqueia leitura de .env', () => {
  const result = security.validatePath('.env', 'read');
  assert(!result.allowed, 'Deveria bloquear leitura de .env');
});

test('Escrita requer confirmação', () => {
  const result = security.validatePath('./outputs/novo.txt', 'write');
  assert(result.allowed, 'Deveria permitir escrita');
  assert(result.requiresConfirmation, 'Deveria requerer confirmação');
});

test('Delete requer confirmação crítica', () => {
  const result = security.validatePath('./temp/apagar.txt', 'delete');
  assert(result.requiresConfirmation, 'Delete deveria requerer confirmação');
});

// ═══════════════════════════════════════════════════════════
// TESTES DE USER ID
// ═══════════════════════════════════════════════════════════

console.log('\n👤 Testes de Identificação\n');

test('Identifica utilizador Telegram', () => {
  const id = security.getUserId({ telegramChatId: 123456 });
  assert(id === 'telegram:123456', 'Deveria formatar ID Telegram');
});

test('Identifica utilizador WhatsApp', () => {
  const id = security.getUserId({ whatsappFrom: '+351912345678' });
  assert(id === 'whatsapp:+351912345678', 'Deveria formatar ID WhatsApp');
});

test('Identifica utilizador CLI', () => {
  const id = security.getUserId({});
  assert(id.startsWith('cli:'), 'Deveria começar com cli:');
});

// ═══════════════════════════════════════════════════════════
// RESUMO
// ═══════════════════════════════════════════════════════════

console.log('\n' + '═'.repeat(60));
console.log(`📊 Resultados: ${colors.green}${passed} passou${colors.reset}, ${colors.red}${failed} falhou${colors.reset}`);
console.log('═'.repeat(60));

if (failed > 0) {
  console.log(`\n${colors.red}❌ Alguns testes falharam! Revê as implementações.${colors.reset}\n`);
  process.exit(1);
} else {
  console.log(`\n${colors.green}✅ Todos os testes passaram! Segurança OK.${colors.reset}\n`);
  process.exit(0);
}
