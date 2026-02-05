/**
 * CalsaBOT - Módulo de Segurança Avançado
 * 
 * Níveis de proteção:
 * - 🟢 LIVRE: Operações seguras sem confirmação
 * - 🟡 AVISO: Requer confirmação simples (s/n)
 * - 🔴 CRÍTICO: Requer confirmação + código de segurança
 * - ⛔ BLOQUEADO: Operação não permitida
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const crypto = require('crypto');

// ═══════════════════════════════════════════════════════════
// CONFIGURAÇÃO DE SEGURANÇA
// ═══════════════════════════════════════════════════════════

const PROJECT_ROOT = path.resolve(__dirname, '..');

// Pastas sempre bloqueadas (sistema)
const BLOCKED_PATHS = [
  'C:\\Windows',
  'C:\\Program Files',
  'C:\\Program Files (x86)',
  'C:\\ProgramData',
  '/etc',
  '/usr',
  '/bin',
  '/sbin',
  '/var',
  '/root'
];

// Ficheiros sensíveis (nunca ler/expor conteúdo)
const SENSITIVE_FILES = [
  '.env',
  '.env.local',
  '.env.production',
  'credentials',
  'secrets',
  '.git/config',
  '.ssh',
  'id_rsa',
  'id_ed25519',
  '.aws/credentials',
  '.azure',
  'wallet.dat'
];

// Padrões de dados sensíveis (regex)
const SENSITIVE_PATTERNS = {
  // Tokens e API Keys
  api_key: /(?:api[_-]?key|apikey|token|bearer|auth)[=:\s]["']?([a-zA-Z0-9_\-]{20,})/gi,
  groq_key: /gsk_[a-zA-Z0-9]{40,}/gi,
  openai_key: /sk-(?:proj-)?[a-zA-Z0-9\-_]{20,}/gi,  // Cobre sk- e sk-proj-
  anthropic_key: /sk-ant-[a-zA-Z0-9\-_]{40,}/gi,
  
  // Passwords
  password: /(?:password|passwd|pwd|senha)[=:\s]["']?([^\s"']{4,})/gi,
  
  // Cartões de crédito
  credit_card: /\b(?:\d{4}[- ]?){3}\d{4}\b/g,
  cvv: /\b(?:cvv|cvc|cv2)[=:\s]?\d{3,4}\b/gi,
  
  // Dados pessoais portugueses
  nif: /\b\d{9}\b/g,  // NIF português
  iban: /\b[A-Z]{2}\d{2}[A-Z0-9]{4,30}\b/gi,
  telefone_pt: /(?:\+351|00351)?9[1236]\d{7}/g,  // Telefone PT com ou sem +351
  cc_pt: /\b\d{8}[- ]?\d[- ]?[A-Z]{2}\d\b/gi,  // Cartão Cidadão
  
  // Emails
  email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g
};

// Operações que requerem confirmação
const CONFIRMATION_REQUIRED = {
  write_file: 'warning',      // 🟡 Escrever ficheiros
  delete_file: 'critical',    // 🔴 Apagar ficheiros
  execute_code: 'warning',    // 🟡 Executar código
  send_network: 'critical',   // 🔴 Enviar dados pela rede
  access_personal: 'critical', // 🔴 Aceder dados pessoais
  modify_config: 'critical',  // 🔴 Modificar configurações
  payment: 'blocked'          // ⛔ Pagamentos (sempre bloqueado sem implementação segura)
};

// Rate limiting
const MAX_EXEC_PER_MIN = 5;
const EXEC_TIMEOUT_MS = 5000;

// Estado
const execCount = new Map();
const sessionCodes = new Map(); // Códigos de segurança por sessão

// ═══════════════════════════════════════════════════════════
// FUNÇÕES DE VERIFICAÇÃO DE CAMINHOS
// ═══════════════════════════════════════════════════════════

function isBlockedPath(targetPath) {
  if (!targetPath) return true;
  
  const absPath = path.resolve(targetPath).toLowerCase();
  
  return BLOCKED_PATHS.some(blocked => 
    absPath.startsWith(blocked.toLowerCase())
  );
}

function isSensitiveFile(filePath) {
  if (!filePath) return true;
  
  const fileName = path.basename(filePath).toLowerCase();
  const fullPath = filePath.toLowerCase();
  
  return SENSITIVE_FILES.some(sensitive => 
    fileName.includes(sensitive.toLowerCase()) ||
    fullPath.includes(sensitive.toLowerCase())
  );
}

function validatePath(targetPath, operation = 'read') {
  if (!targetPath || typeof targetPath !== 'string') {
    return { allowed: false, reason: 'Caminho inválido', level: 'blocked' };
  }
  
  const absPath = path.resolve(targetPath);
  
  // Verificar caminhos bloqueados
  if (isBlockedPath(absPath)) {
    return { 
      allowed: false, 
      reason: `Acesso bloqueado a pasta do sistema: ${absPath}`,
      level: 'blocked'
    };
  }
  
  // Verificar ficheiros sensíveis
  if (isSensitiveFile(absPath)) {
    if (operation === 'read') {
      return {
        allowed: false,
        reason: `Ficheiro sensível - leitura bloqueada: ${path.basename(absPath)}`,
        level: 'blocked'
      };
    }
    return {
      allowed: true,
      reason: `Ficheiro sensível - requer confirmação crítica`,
      level: 'critical',
      requiresConfirmation: true
    };
  }
  
  // Escrita requer confirmação
  if (operation === 'write' || operation === 'delete') {
    return {
      allowed: true,
      reason: `Operação de ${operation} requer confirmação`,
      level: 'warning',
      requiresConfirmation: true
    };
  }
  
  // Leitura livre
  return { allowed: true, level: 'free' };
}

// ═══════════════════════════════════════════════════════════
// DETEÇÃO DE DADOS SENSÍVEIS
// ═══════════════════════════════════════════════════════════

function detectSensitiveData(text) {
  if (!text || typeof text !== 'string') return { hasSensitive: false, types: [] };
  
  const detected = [];
  
  for (const [type, pattern] of Object.entries(SENSITIVE_PATTERNS)) {
    const matches = text.match(pattern);
    if (matches && matches.length > 0) {
      detected.push({
        type,
        count: matches.length,
        // Não armazenar os dados reais, só a informação
        preview: matches[0].substring(0, 4) + '****'
      });
    }
  }
  
  return {
    hasSensitive: detected.length > 0,
    types: detected,
    level: detected.length > 0 ? 'critical' : 'free'
  };
}

function maskSensitiveData(text) {
  if (!text || typeof text !== 'string') return text;
  
  let masked = text;
  
  // Mascarar cada padrão sensível
  for (const [type, pattern] of Object.entries(SENSITIVE_PATTERNS)) {
    masked = masked.replace(pattern, (match) => {
      if (match.length <= 4) return '****';
      return match.substring(0, 4) + '*'.repeat(match.length - 4);
    });
  }
  
  return masked;
}

// ═══════════════════════════════════════════════════════════
// SISTEMA DE CONFIRMAÇÃO
// ═══════════════════════════════════════════════════════════

function generateSecurityCode() {
  return crypto.randomInt(1000, 9999).toString();
}

async function askConfirmation(question, level = 'warning') {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  return new Promise((resolve) => {
    if (level === 'warning') {
      // Confirmação simples
      rl.question(`\n⚠️  ${question} (s/n): `, (answer) => {
        rl.close();
        resolve({ confirmed: answer.trim().toLowerCase() === 's' });
      });
    } else if (level === 'critical') {
      // Confirmação com código
      const code = generateSecurityCode();
      console.log(`\n🔴 AÇÃO CRÍTICA: ${question}`);
      console.log(`📟 Código de segurança: ${code}`);
      
      rl.question(`Digite o código para confirmar: `, (answer) => {
        rl.close();
        resolve({ 
          confirmed: answer.trim() === code,
          codeMatch: answer.trim() === code
        });
      });
    } else {
      rl.close();
      resolve({ confirmed: false, reason: 'Nível desconhecido' });
    }
  });
}

// Versão para bots (Telegram/WhatsApp) - retorna mensagem para o utilizador
function getConfirmationMessage(action, level, details = {}) {
  if (level === 'warning') {
    return {
      message: `⚠️ **Confirmação Necessária**\n\nAção: ${action}\n\nResponde "CONFIRMO" para prosseguir ou "CANCELAR" para abortar.`,
      expectedResponse: 'CONFIRMO'
    };
  } else if (level === 'critical') {
    const code = generateSecurityCode();
    return {
      message: `🔴 **AÇÃO CRÍTICA**\n\nAção: ${action}\n${details.warning || ''}\n\n📟 Código de segurança: **${code}**\n\nDigita o código para confirmar:`,
      expectedResponse: code,
      code: code
    };
  }
  
  return { message: 'Operação não permitida', blocked: true };
}

// ═══════════════════════════════════════════════════════════
// RATE LIMITING
// ═══════════════════════════════════════════════════════════

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

// ═══════════════════════════════════════════════════════════
// LOGGING SEGURO
// ═══════════════════════════════════════════════════════════

const LOG_FILE = path.join(PROJECT_ROOT, 'memory', 'security.log');

function logSecurityEvent(userId, event, details = {}) {
  const timestamp = new Date().toISOString();
  
  // Mascarar dados sensíveis nos logs
  const safeDetails = {};
  for (const [key, value] of Object.entries(details)) {
    if (typeof value === 'string') {
      safeDetails[key] = maskSensitiveData(value);
    } else {
      safeDetails[key] = value;
    }
  }
  
  const logEntry = {
    timestamp,
    userId,
    event,
    details: safeDetails
  };
  
  const line = `[${timestamp}] ${userId} | ${event} | ${JSON.stringify(safeDetails)}\n`;
  
  try {
    const logDir = path.dirname(LOG_FILE);
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    fs.appendFileSync(LOG_FILE, line);
  } catch (err) {
    console.error('Erro ao gravar log de segurança:', err.message);
  }
  
  return logEntry;
}

// ═══════════════════════════════════════════════════════════
// EXECUÇÃO SEGURA DE CÓDIGO
// ═══════════════════════════════════════════════════════════

const vm = require('vm');

async function safeExecuteCode(userId, code, options = {}) {
  const { skipConfirmation = false, isBot = false } = options;
  
  // Verificar rate limit
  if (isRateLimited(userId)) {
    logSecurityEvent(userId, 'rate-limited', { action: 'execute_code' });
    return {
      success: false,
      error: `Rate limit atingido. Aguarda 1 minuto. (${MAX_EXEC_PER_MIN}/min)`
    };
  }
  
  // Detetar dados sensíveis no código
  const sensitiveCheck = detectSensitiveData(code);
  if (sensitiveCheck.hasSensitive) {
    logSecurityEvent(userId, 'sensitive-data-in-code', { types: sensitiveCheck.types });
    return {
      success: false,
      error: `Código contém dados sensíveis (${sensitiveCheck.types.map(t => t.type).join(', ')}). Execução bloqueada.`
    };
  }
  
  // Mostrar código e pedir confirmação
  if (!skipConfirmation && !isBot) {
    console.log('\n📜 Código a executar:');
    console.log('─'.repeat(40));
    console.log(code);
    console.log('─'.repeat(40));
    
    const confirmation = await askConfirmation('Confirmas a execução deste código?', 'warning');
    if (!confirmation.confirmed) {
      logSecurityEvent(userId, 'execution-cancelled', { codeLength: code.length });
      return { success: false, error: 'Execução cancelada pelo utilizador.' };
    }
  }
  
  // Executar em sandbox
  try {
    const sandbox = {
      console: {
        log: (...args) => console.log('[Output]', ...args),
        error: (...args) => console.error('[Output]', ...args),
        warn: (...args) => console.warn('[Output]', ...args)
      },
      Math,
      Date,
      JSON,
      parseInt,
      parseFloat,
      isNaN,
      isFinite,
      // Bloquear acesso perigoso
      require: undefined,
      process: undefined,
      __dirname: undefined,
      __filename: undefined,
      global: undefined,
      Buffer: undefined,
      fetch: undefined,
      XMLHttpRequest: undefined
    };
    
    const context = vm.createContext(sandbox);
    const script = new vm.Script(code, { timeout: EXEC_TIMEOUT_MS });
    const result = script.runInContext(context, { timeout: EXEC_TIMEOUT_MS });
    
    recordExecution(userId);
    logSecurityEvent(userId, 'code-executed', { codeLength: code.length });
    
    return {
      success: true,
      result: result !== undefined ? String(result) : '(sem retorno)',
      remaining: getRemainingExecutions(userId)
    };
    
  } catch (err) {
    logSecurityEvent(userId, 'execution-error', { error: err.message });
    
    if (err.message.includes('timed out')) {
      return { success: false, error: `Timeout: Código excedeu ${EXEC_TIMEOUT_MS/1000}s` };
    }
    
    return { success: false, error: `Erro: ${err.message}` };
  }
}

// ═══════════════════════════════════════════════════════════
// OPERAÇÕES DE FICHEIROS SEGURAS
// ═══════════════════════════════════════════════════════════

async function safeReadFile(userId, filePath, options = {}) {
  const validation = validatePath(filePath, 'read');
  
  if (!validation.allowed) {
    logSecurityEvent(userId, 'read-blocked', { path: filePath, reason: validation.reason });
    return { success: false, error: validation.reason };
  }
  
  try {
    const absPath = path.resolve(filePath);
    
    if (!fs.existsSync(absPath)) {
      return { success: false, error: `Ficheiro não encontrado: ${filePath}` };
    }
    
    const content = fs.readFileSync(absPath, 'utf-8');
    
    // Verificar se o conteúdo tem dados sensíveis
    const sensitiveCheck = detectSensitiveData(content);
    if (sensitiveCheck.hasSensitive) {
      logSecurityEvent(userId, 'sensitive-content-masked', { 
        path: filePath, 
        types: sensitiveCheck.types 
      });
      
      // Retornar versão mascarada
      return {
        success: true,
        content: maskSensitiveData(content),
        warning: `⚠️ Alguns dados sensíveis foram mascarados (${sensitiveCheck.types.map(t => t.type).join(', ')})`
      };
    }
    
    logSecurityEvent(userId, 'file-read', { path: filePath });
    return { success: true, content };
    
  } catch (err) {
    return { success: false, error: `Erro ao ler: ${err.message}` };
  }
}

async function safeWriteFile(userId, filePath, content, options = {}) {
  const { skipConfirmation = false } = options;
  
  const validation = validatePath(filePath, 'write');
  
  if (!validation.allowed) {
    logSecurityEvent(userId, 'write-blocked', { path: filePath, reason: validation.reason });
    return { success: false, error: validation.reason };
  }
  
  // Verificar dados sensíveis no conteúdo
  const sensitiveCheck = detectSensitiveData(content);
  if (sensitiveCheck.hasSensitive) {
    console.log(`\n🔴 AVISO: O conteúdo contém dados sensíveis!`);
    console.log(`   Tipos: ${sensitiveCheck.types.map(t => t.type).join(', ')}`);
    
    if (!skipConfirmation) {
      const confirmation = await askConfirmation(
        'Tens a certeza que queres gravar dados sensíveis?',
        'critical'
      );
      
      if (!confirmation.confirmed) {
        logSecurityEvent(userId, 'write-cancelled-sensitive', { path: filePath });
        return { success: false, error: 'Escrita cancelada - dados sensíveis detetados' };
      }
    }
  }
  
  // Confirmação normal para escrita
  if (validation.requiresConfirmation && !skipConfirmation) {
    const confirmation = await askConfirmation(
      `Gravar ficheiro: ${filePath}?`,
      validation.level
    );
    
    if (!confirmation.confirmed) {
      logSecurityEvent(userId, 'write-cancelled', { path: filePath });
      return { success: false, error: 'Escrita cancelada pelo utilizador' };
    }
  }
  
  try {
    const absPath = path.resolve(filePath);
    const dir = path.dirname(absPath);
    
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    fs.writeFileSync(absPath, content, 'utf-8');
    logSecurityEvent(userId, 'file-written', { path: filePath, size: content.length });
    
    return { success: true, path: absPath };
    
  } catch (err) {
    return { success: false, error: `Erro ao escrever: ${err.message}` };
  }
}

async function safeDeleteFile(userId, filePath, options = {}) {
  const validation = validatePath(filePath, 'delete');
  
  if (!validation.allowed) {
    logSecurityEvent(userId, 'delete-blocked', { path: filePath, reason: validation.reason });
    return { success: false, error: validation.reason };
  }
  
  // Eliminação SEMPRE requer confirmação crítica
  console.log(`\n🔴 ATENÇÃO: Vais eliminar permanentemente:`);
  console.log(`   ${filePath}`);
  
  const confirmation = await askConfirmation('Eliminar este ficheiro?', 'critical');
  
  if (!confirmation.confirmed) {
    logSecurityEvent(userId, 'delete-cancelled', { path: filePath });
    return { success: false, error: 'Eliminação cancelada' };
  }
  
  try {
    const absPath = path.resolve(filePath);
    fs.unlinkSync(absPath);
    logSecurityEvent(userId, 'file-deleted', { path: filePath });
    return { success: true, message: `Ficheiro eliminado: ${filePath}` };
  } catch (err) {
    return { success: false, error: `Erro ao eliminar: ${err.message}` };
  }
}

// ═══════════════════════════════════════════════════════════
// FUNÇÕES DE COMPATIBILIDADE (mantém API do security.js)
// ═══════════════════════════════════════════════════════════

// Alias para logSecurityEvent (compatibilidade)
function logAction(userId, action, data = {}) {
  return logSecurityEvent(userId, action, data);
}

// Listar diretório de forma segura
function safeListDir(dirPath) {
  const absPath = path.resolve(dirPath);
  
  if (isBlockedPath(absPath)) {
    throw new Error(`Acesso negado: ${absPath}`);
  }
  
  const items = fs.readdirSync(absPath, { withFileTypes: true });
  return items.map(item => {
    const icon = item.isDirectory() ? '📁' : '📄';
    return `${icon} ${item.name}`;
  });
}

// Confirmar e executar código (requer confirmação humana)
async function confirmAndRun(userId, code, isBot = false) {
  // Se é um bot, verificar rate limiting primeiro
  if (isRateLimited(userId)) {
    const remaining = getRemainingExecutions(userId);
    return `⚠️ Rate limit atingido. Execuções restantes: ${remaining}/${MAX_EXEC_PER_MIN}`;
  }
  
  // Verificar se código contém operações perigosas
  const dangerPatterns = [
    /\brm\s+-rf\b/i,
    /\bdel\s+\/[sq]\b/i,
    /format\s+[a-z]:/i,
    /shutdown|restart|reboot/i,
    /\bexec\s*\(/i,
    /child_process/i,
    /require\s*\(\s*['"]child_process/i
  ];
  
  const isDangerous = dangerPatterns.some(p => p.test(code));
  
  if (isDangerous) {
    logSecurityEvent(userId, 'dangerous-code-blocked', { code: code.substring(0, 100) });
    return `🚫 **Código bloqueado por segurança**
    
O código contém operações potencialmente perigosas que não são permitidas.`;
  }
  
  // Executar código de forma segura
  const result = await safeExecuteCode(code, userId);
  return result.success 
    ? `✅ Resultado:\n\`\`\`\n${result.output || '(sem output)'}\n\`\`\``
    : `❌ Erro: ${result.error}`;
}

// ═══════════════════════════════════════════════════════════
// OBTER USER ID
// ═══════════════════════════════════════════════════════════

function getUserId(context = {}) {
  if (context.telegramChatId) {
    return `telegram:${context.telegramChatId}`;
  }
  if (context.whatsappFrom) {
    return `whatsapp:${context.whatsappFrom}`;
  }
  return `cli:${process.env.USERNAME || process.env.USER || 'local'}`;
}

// ═══════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════

module.exports = {
  // Validação
  validatePath,
  isBlockedPath,
  isSensitiveFile,
  detectSensitiveData,
  maskSensitiveData,
  
  // Confirmação
  askConfirmation,
  getConfirmationMessage,
  confirmAndRun,  // Compatibilidade
  
  // Rate limiting
  isRateLimited,
  getRemainingExecutions,
  recordExecution,
  
  // Operações seguras
  safeExecuteCode,
  safeReadFile,
  safeWriteFile,
  safeDeleteFile,
  safeListDir,  // Compatibilidade
  
  // Logging
  logSecurityEvent,
  logAction,  // Alias para logSecurityEvent
  
  // Utilidades
  getUserId,
  
  // Constantes
  BLOCKED_PATHS,
  SENSITIVE_FILES,
  SENSITIVE_PATTERNS,
  MAX_EXEC_PER_MIN,
  EXEC_TIMEOUT_MS
};
