/**
 * Local Runner - Execução segura de código
 * 
 * SUBSTITUÍDO pelo security.confirmAndRun()
 * Este ficheiro mantém-se por compatibilidade mas delega para o módulo de segurança
 */

const security = require('../orchestrator/security');

async function run(script, userId = 'unknown') {
  // Extrair código do prompt (remover comandos como "executar:", "rodar:", "run:", etc.)
  let cleanScript = script
    .replace(/^(executar|rodar|run)\s*:\s*/i, '')  // Remove "Executar: " com dois pontos
    .replace(/^(executar|rodar|run)\s+/i, '')       // Remove "Executar " sem dois pontos
    .trim();
  
  if (!cleanScript) {
    return '❌ Nenhum código fornecido para executar.';
  }
  
  // Delegar para o módulo de segurança
  return await security.confirmAndRun(userId, cleanScript, false);
}

module.exports = { run };
