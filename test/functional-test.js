/**
 * Testes Funcionais do CalsaBOT
 * Verifica que todas as funcionalidades principais estão a funcionar
 */

require('dotenv').config();
const orchestrator = require('../orchestrator/orchestrator');

// Cores para output
const green = '\x1b[32m';
const red = '\x1b[31m';
const yellow = '\x1b[33m';
const reset = '\x1b[0m';

let passed = 0;
let failed = 0;
const results = [];

async function test(name, fn) {
  try {
    await fn();
    results.push({ name, status: 'pass' });
    passed++;
  } catch (err) {
    results.push({ name, status: 'fail', error: err.message });
    failed++;
  }
}

async function runTests() {
  console.log('\n' + '═'.repeat(60));
  console.log('🧪 CalsaBOT - Testes Funcionais');
  console.log('═'.repeat(60) + '\n');

  // Contexto simulado
  const cliContext = { type: 'cli', username: 'test-user' };

  // ───── TESTE 1: Info Sistema ─────
  await test('Info do sistema', async () => {
    const response = await orchestrator.handlePrompt('info sistema', cliContext);
    if (!response.includes('Sistema:')) {
      throw new Error('Não retornou informação do sistema');
    }
  });

  // ───── TESTE 2: Pergunta IA ─────
  await test('Pergunta à IA', async () => {
    const response = await orchestrator.handlePrompt('Olá, qual é o teu nome?', cliContext);
    if (!response || response.length < 10) {
      throw new Error('Resposta da IA muito curta');
    }
  });

  // ───── TESTE 3: Listar ficheiros ─────
  await test('Listar ficheiros', async () => {
    const response = await orchestrator.handlePrompt('listar ficheiros', cliContext);
    if (!response.includes('Ficheiros')) {
      throw new Error('Não retornou lista de ficheiros');
    }
  });

  // ───── TESTE 4: Criar nota ─────
  await test('Criar nota', async () => {
    const response = await orchestrator.handlePrompt('criar nota de teste funcional', cliContext);
    if (!response.includes('Nota criada')) {
      throw new Error('Não confirmou criação da nota');
    }
  });

  // ───── TESTE 5: Ver logs ─────
  await test('Ver logs', async () => {
    const response = await orchestrator.handlePrompt('ver logs', cliContext);
    // Pode não haver logs, mas não deve dar erro
    if (response.includes('Erro')) {
      throw new Error('Erro ao ver logs');
    }
  });

  // ───── TESTE 6: Executar código ─────
  await test('Executar código simples', async () => {
    const response = await orchestrator.handlePrompt('Executar: console.log(2+2)', cliContext);
    // Deve executar ou pelo menos responder sem erro
    if (response.includes('Erro no Orchestrator')) {
      throw new Error('Erro ao processar execução');
    }
  });

  // ───── RESULTADOS ─────
  console.log('\n📊 Resultados:');
  console.log('─'.repeat(40));

  for (const r of results) {
    if (r.status === 'pass') {
      console.log(`${green}✅ ${r.name}${reset}`);
    } else {
      console.log(`${red}❌ ${r.name}: ${r.error}${reset}`);
    }
  }

  console.log('─'.repeat(40));
  console.log(`\n📈 Total: ${passed} passou, ${failed} falhou`);
  
  if (failed === 0) {
    console.log(`${green}\n✅ Todos os testes funcionais passaram!${reset}\n`);
    process.exit(0);
  } else {
    console.log(`${red}\n❌ Alguns testes falharam${reset}\n`);
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Erro ao executar testes:', err);
  process.exit(1);
});
