/**
 * Security Module - Segurança e controlo de acessos do CalsaBOT
 * 
 * Funcionalidades:
 * - Whitelist de pastas (leitura/escrita)
 * - Rate limiting por utilizador
 * - Execução segura de código com sandbox
 * - Logging de todas as ações
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const readline = require('readline');

// ───── CONFIGURAÇÕES ─────
const PROJECT_ROOT = path.resolve(__dirname, '..');

const ALLOWED_READ = [
  path.join(PROJECT_ROOT, 'Documentos'),
  path.join(PROJECT_ROOT, 'outputs'),
  path.join(PROJECT_ROOT, 'memory'),
  path.join(PROJECT_ROOT, 'temp')
];

const ALLOWED_WRITE = [
  path.join(PROJECT_ROOT, 'Documentos'),
  path.join(PROJECT_ROOT, 'outputs'),
  path.join(PROJECT_ROOT, 'temp')
];

const MAX_EXEC_PER_MIN = 5;
const EXEC_TIMEOUT_MS = 5000;
const LOG_FILE = path.join(PROJECT_ROOT, 'memory', 'interactions.log');

// ───── ESTADO ─────
const execCount = new Map(); // userId -> array de timestamps

// ───── WHITELIST DE CAMINHOS ─────
function isAllowedPath(targetPath, mode = 'read') {
  // Proteção contra null/undefined
  if (!targetPath || typeof targetPath !== 'string') {
    return false;
  }
  
  const absPath = path.resolve(targetPath);
  const list = mode === 'read' ? ALLOWED_READ : ALLOWED_WRITE;
  
  return list.some(allowedDir => {
    return absPath.startsWith(allowedDir + path.sep) || absPath === allowedDir;
  });
}

function validateFilePath(filePath, mode = 'read') {
  // Proteção contra null/undefined
  if (!filePath || typeof filePath !== 'string') {
    throw new Error('Caminho de ficheiro não especificado');
  }
  
  const absPath = path.resolve(filePath);
  
  if (!isAllowedPath(absPath, mode)) {
    throw new Error(`🚫 Caminho não autorizado: ${absPath}`);
  }
  
  return absPath;
}

// ───── RATE LIMITING ─────
function isRateLimited(userId) {
  const now = Date.now();
  const minuteAgo = now - 60000;
  
  let counts = execCount.get(userId) || [];
  counts = counts.filter(t => t > minuteAgo);
  execCount.set(userId, counts);
  
  return counts.length >= MAX_EXEC_PER_MIN;
}

function recordExecution(userId) {
  const counts = execCount.get(userId) || [];
  counts.push(Date.now());
  execCount.set(userId, counts);
}

function getRemainingExecutions(userId) {
  const now = Date.now();
  const minuteAgo = now - 60000;
  const counts = (execCount.get(userId) || []).filter(t => t > minuteAgo);
  return Math.max(0, MAX_EXEC_PER_MIN - counts.length);
}

// ───── LOGGER ─────
function logAction(userId, action, details = null) {
  const timestamp = new Date().toISOString();
  const detailsStr = details ? ' ' + JSON.stringify(details) : '';
  const line = `[${timestamp}] ${userId} | ${action}${detailsStr}\n`;
  
  try {
    // Garantir que a pasta existe
    const logDir = path.dirname(LOG_FILE);
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    
    fs.appendFileSync(LOG_FILE, line);
  } catch (err) {
    console.error('⚠️ Erro ao gravar log:', err.message);
  }
}

// ───── EXECUÇÃO SEGURA DE CÓDIGO ─────
function askConfirmation(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  return new Promise(resolve => {
    rl.question(question, answer => {
      rl.close();
      resolve(answer.trim().toLowerCase());
    });
  });
}

async function confirmAndRun(userId, code, skipConfirmation = false) {
  // 1. Verificar rate limit
  if (isRateLimited(userId)) {
    logAction(userId, 'exec-rate-limited', { code: code.substring(0, 100) });
    return `⚠️ Rate limit atingido. Aguarda 1 minuto. (${MAX_EXEC_PER_MIN} execuções/min)`;
  }
  
  // 2. Mostrar código antes de confirmar
  console.log('\n📜 Código a executar:');
  console.log('─'.repeat(40));
  console.log(code);
  console.log('─'.repeat(40));
  
  // 3. Pedir confirmação (exceto se skipConfirmation for true - usado em bots)
  if (!skipConfirmation) {
    const answer = await askConfirmation('\n⚠️ Confirmas a execução deste código? (s/n): ');
    
    if (answer !== 's' && answer !== 'sim') {
      logAction(userId, 'exec-cancelled', { codeLength: code.length });
      return '❌ Execução cancelada pelo utilizador.';
    }
  }
  
  // 4. Executar em sandbox segura
  try {
    const sandbox = {
      console: {
        log: (...args) => console.log('[Sandbox]', ...args),
        error: (...args) => console.error('[Sandbox]', ...args),
        warn: (...args) => console.warn('[Sandbox]', ...args)
      },
      setTimeout: undefined,
      setInterval: undefined,
      setImmediate: undefined,
      require: undefined,
      process: undefined,
      __dirname: undefined,
      __filename: undefined,
      Buffer: undefined,
      result: null
    };
    
    const context = vm.createContext(sandbox);
    
    const wrappedCode = `
      (function() {
        ${code}
      })();
    `;
    
    const script = new vm.Script(wrappedCode, { timeout: EXEC_TIMEOUT_MS });
    const result = script.runInContext(context, { timeout: EXEC_TIMEOUT_MS });
    
    recordExecution(userId);
    logAction(userId, 'exec-success', { codeLength: code.length });
    
    const remaining = getRemainingExecutions(userId);
    return `✅ Código executado com sucesso.\nResultado: ${result ?? '(sem retorno)'}\n📊 Execuções restantes: ${remaining}/${MAX_EXEC_PER_MIN}`;
    
  } catch (err) {
    logAction(userId, 'exec-error', { error: err.message });
    
    if (err.message.includes('Script execution timed out')) {
      return `⏱️ Timeout: O código excedeu ${EXEC_TIMEOUT_MS / 1000}s de execução.`;
    }
    
    return `❌ Erro na execução: ${err.message}`;
  }
}

// ───── SAFE FILE OPERATIONS ─────
function safeReadFile(filePath) {
  const absPath = validateFilePath(filePath, 'read');
  return fs.readFileSync(absPath, 'utf-8');
}

function safeWriteFile(filePath, content) {
  const absPath = validateFilePath(filePath, 'write');
  
  // Garantir que o diretório existe
  const dir = path.dirname(absPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  
  fs.writeFileSync(absPath, content, 'utf-8');
  return absPath;
}

function safeListDir(dirPath) {
  const absPath = validateFilePath(dirPath, 'read');
  return fs.readdirSync(absPath);
}

// ───── OBTER USER ID ─────
function getUserId(context) {
  if (context.telegramChatId) {
    return `telegram:${context.telegramChatId}`;
  }
  if (context.whatsappFrom) {
    return `whatsapp:${context.whatsappFrom}`;
  }
  // CLI - usar username do sistema
  return `cli:${process.env.USERNAME || process.env.USER || 'local'}`;
}

// ───── EXPORTS ─────
module.exports = {
  isAllowedPath,
  validateFilePath,
  isRateLimited,
  getRemainingExecutions,
  logAction,
  confirmAndRun,
  safeReadFile,
  safeWriteFile,
  safeListDir,
  getUserId,
  ALLOWED_READ,
  ALLOWED_WRITE,
  MAX_EXEC_PER_MIN
};
