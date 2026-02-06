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
const crypto = require('crypto');

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
const RATE_LIMIT_FILE = path.join(PROJECT_ROOT, 'memory', 'rate-limit.json');
const MAX_MEMORY_MB = 128; // Limite de memória para sandbox

// ───── ESTADO ─────
let execCount = new Map(); // userId -> array de timestamps

// 💾 Carregar rate-limits persistidos ao iniciar
function loadRateLimits() {
  try {
    if (fs.existsSync(RATE_LIMIT_FILE)) {
      const data = JSON.parse(fs.readFileSync(RATE_LIMIT_FILE, 'utf-8'));
      const now = Date.now();
      const minuteAgo = now - 60000;
      
      // Filtrar apenas entradas válidas (menos de 1 minuto)
      for (const [userId, timestamps] of Object.entries(data)) {
        const validTimestamps = timestamps.filter(t => t > minuteAgo);
        if (validTimestamps.length > 0) {
          execCount.set(userId, validTimestamps);
        }
      }
    }
  } catch (err) {
    console.warn('⚠️ Erro ao carregar rate-limits:', err.message);
  }
}

// 💾 Guardar rate-limits para persistência
function saveRateLimits() {
  try {
    const logDir = path.dirname(RATE_LIMIT_FILE);
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    fs.writeFileSync(RATE_LIMIT_FILE, JSON.stringify(Object.fromEntries(execCount), null, 2));
  } catch (err) {
    console.warn('⚠️ Erro ao guardar rate-limits:', err.message);
  }
}

// Carregar ao iniciar
loadRateLimits();

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
  
  // Persistir automaticamente após cada execução
  saveRateLimits();
}

function getRemainingExecutions(userId) {
  const now = Date.now();
  const minuteAgo = now - 60000;
  const counts = (execCount.get(userId) || []).filter(t => t > minuteAgo);
  return Math.max(0, MAX_EXEC_PER_MIN - counts.length);
}

// ───── HASH DE USER ID (PRIVACIDADE) ─────
function hashUserId(userId) {
  return crypto.createHash('sha256').update(userId).digest('hex').slice(0, 8);
}

// ───── LOGGER ─────
function logAction(userId, action, details = null) {
  const timestamp = new Date().toISOString();
  // 🔒 Hash do userId para privacidade (não expor identificadores reais)
  const hashedId = hashUserId(userId);
  const detailsStr = details ? ' ' + JSON.stringify(details) : '';
  const line = `[${timestamp}] ${hashedId} | ${action}${detailsStr}\n`;
  
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

// ───── GLOBAL ERROR HANDLER & MEMORY WATCHER ─────
// 🛡️ Kill-switch para erros não tratados
process.on('uncaughtException', (err) => {
  console.error('💥 Erro fatal não tratado:', err.message);
  saveRateLimits(); // Guardar estado antes de sair
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Promise rejeitada não tratada:', reason);
  saveRateLimits();
});

// 📊 Memory watcher - alerta se usar muita RAM
const MEMORY_CHECK_INTERVAL = 30000; // 30 segundos
setInterval(() => {
  const used = process.memoryUsage();
  const heapMB = Math.round(used.heapUsed / 1024 / 1024);
  
  if (heapMB > MAX_MEMORY_MB) {
    console.warn(`⚠️ Memória alta: ${heapMB}MB (limite: ${MAX_MEMORY_MB}MB)`);
    logAction('system', 'memory-warning', { heapMB, limit: MAX_MEMORY_MB });
    
    // Limpar rate-limits antigos para libertar memória
    const now = Date.now();
    const minuteAgo = now - 60000;
    for (const [userId, timestamps] of execCount.entries()) {
      const valid = timestamps.filter(t => t > minuteAgo);
      if (valid.length === 0) {
        execCount.delete(userId);
      } else {
        execCount.set(userId, valid);
      }
    }
    
    // Forçar garbage collection se disponível
    if (global.gc) {
      global.gc();
    }
  }
}, MEMORY_CHECK_INTERVAL);

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
  hashUserId,
  saveRateLimits,
  loadRateLimits,
  ALLOWED_READ,
  ALLOWED_WRITE,
  MAX_EXEC_PER_MIN,
  MAX_MEMORY_MB
};
