/**
 * Orchestrator - Cérebro do CalsaBOT
 * 
 * Analisa intenções e encaminha para o agente correto
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const intentParser = require('./intentParser');
const security = require('./securityAdvanced');  // Usar segurança avançada
const pdfAgent = require('../agents/pdfAgent');
const aiAgent = require('../agents/aiAgents');
const copilotAgent = require('../agents/copilot');
const fileAgent = require('../agents/fileAgent');
const localRunner = require('../agents/localRunner');

async function handlePrompt(prompt, context = {}) {
  const userId = security.getUserId(context);
  
  try {
    // Log da ação
    security.logAction(userId, 'prompt-received', { prompt: prompt.substring(0, 100) });
    
    // Analisar intenção
    const intentData = intentParser.parseIntent(prompt);
    security.logAction(userId, 'intent-parsed', { intent: intentData.intent });

    switch (intentData.intent) {
      case 'create_pdf':
        const pdfPath = await pdfAgent.createPDF(prompt, intentData.entities.folder);
        return `📄 PDF criado com sucesso!\n📁 Localização: ${pdfPath}`;

      case 'view_logs':
        return await viewLogs();

      case 'create_note':
        return await createNote(prompt, userId);

      case 'list_files':
        return await listAllFiles();

      case 'system_info':
        return getSystemInfo();

      case 'run_code':
        return await security.confirmAndRun(userId, prompt, context.isBot || false);

      case 'execute_local':
        if (security.isRateLimited(userId)) {
          const remaining = security.getRemainingExecutions(userId);
          return `⚠️ Rate limit atingido. Execuções restantes: ${remaining}/${security.MAX_EXEC_PER_MIN}. Aguarda 1 minuto.`;
        }
        return await localRunner.run(prompt, userId);

      case 'read_file':
        try {
          const files = security.safeListDir(process.cwd());
          return `📂 Ficheiros na pasta atual:\n${files.join('\n')}`;
        } catch (err) {
          return `❌ Erro ao ler: ${err.message}`;
        }

      case 'write_file':
        return await fileAgent.handleFile(intentData, userId);

      default:
        const response = await aiAgent.askAI(prompt);
        return `🧠 ${response}`;
    }

  } catch (err) {
    security.logAction(userId, 'error', { error: err.message });
    return `❌ Erro no Orchestrator: ${err.message || err}`;
  }
}

// ───── NOVAS FUNÇÕES ─────

async function viewLogs() {
  const logFile = path.join(__dirname, '..', 'memory', 'interactions.log');
  
  try {
    if (!fs.existsSync(logFile)) {
      return '📋 Nenhum log encontrado ainda.';
    }
    
    const content = fs.readFileSync(logFile, 'utf-8');
    const lines = content.trim().split('\n');
    const lastLines = lines.slice(-15); // Últimas 15 entradas
    
    let result = '📋 **Últimas Atividades do CalsaBOT:**\n\n';
    
    for (const line of lastLines) {
      // Formatar linha do log
      const match = line.match(/\[(.*?)\]\s*(.*?)\s*\|\s*(.*)/);
      if (match) {
        const [, timestamp, user, action] = match;
        const date = new Date(timestamp);
        const timeStr = date.toLocaleTimeString('pt-PT');
        result += `⏱️ ${timeStr} | 👤 ${user} | ${action}\n`;
      }
    }
    
    result += `\n📊 Total de registos: ${lines.length}`;
    return result;
    
  } catch (err) {
    return `❌ Erro ao ler logs: ${err.message}`;
  }
}

async function createNote(prompt, userId) {
  const notesDir = path.join(__dirname, '..', 'Documentos', 'notas');
  
  // Criar pasta se não existir
  if (!fs.existsSync(notesDir)) {
    fs.mkdirSync(notesDir, { recursive: true });
  }
  
  // Gerar nome do ficheiro com data
  const date = new Date();
  const dateStr = date.toISOString().split('T')[0];
  const timeStr = date.toTimeString().split(' ')[0].replace(/:/g, '-');
  const fileName = `nota_${dateStr}_${timeStr}.txt`;
  const filePath = path.join(notesDir, fileName);
  
  // Extrair conteúdo da nota (remover palavras-chave)
  let content = prompt
    .replace(/^(criar?|nova?|adicionar?)\s*(nota|tarefa|lembrete|todo)\s*/i, '')
    .trim();
  
  if (!content) {
    content = 'Nota criada pelo CalsaBOT';
  }
  
  // Formatar nota
  const noteContent = `📝 NOTA - ${date.toLocaleString('pt-PT')}
${'═'.repeat(40)}

${content}

${'─'.repeat(40)}
Criado por: CalsaBOT
`;

  fs.writeFileSync(filePath, noteContent, 'utf-8');
  security.logAction(userId, 'note-created', { path: filePath });
  
  return `📝 Nota criada com sucesso!\n📁 Ficheiro: ${filePath}\n\n📄 Conteúdo:\n${content}`;
}

async function listAllFiles() {
  const projectRoot = path.join(__dirname, '..');
  const allowedDirs = ['Documentos', 'outputs', 'temp'];
  
  let result = '📂 **Ficheiros do CalsaBOT:**\n\n';
  
  for (const dir of allowedDirs) {
    const dirPath = path.join(projectRoot, dir);
    
    if (fs.existsSync(dirPath)) {
      result += `📁 **${dir}/**\n`;
      
      try {
        const items = fs.readdirSync(dirPath, { withFileTypes: true });
        
        if (items.length === 0) {
          result += '   (vazio)\n';
        } else {
          for (const item of items.slice(0, 10)) { // Limitar a 10 itens
            const icon = item.isDirectory() ? '📁' : '📄';
            result += `   ${icon} ${item.name}\n`;
          }
          if (items.length > 10) {
            result += `   ... e mais ${items.length - 10} itens\n`;
          }
        }
      } catch (err) {
        result += `   ⚠️ Erro: ${err.message}\n`;
      }
      
      result += '\n';
    }
  }
  
  return result;
}

function getSystemInfo() {
  const uptime = process.uptime();
  const memUsage = process.memoryUsage();
  
  return `💻 **Informação do Sistema:**

🖥️ **Computador:**
   • Nome: ${os.hostname()}
   • Sistema: ${os.platform()} ${os.release()}
   • Arquitetura: ${os.arch()}
   • CPUs: ${os.cpus().length} cores

💾 **Memória:**
   • Total: ${(os.totalmem() / 1024 / 1024 / 1024).toFixed(1)} GB
   • Livre: ${(os.freemem() / 1024 / 1024 / 1024).toFixed(1)} GB
   • Usada pelo CalsaBOT: ${(memUsage.heapUsed / 1024 / 1024).toFixed(1)} MB

⏱️ **CalsaBOT:**
   • Uptime: ${formatUptime(uptime)}
   • Node.js: ${process.version}
   • PID: ${process.pid}

👤 **Utilizador:**
   • Nome: ${os.userInfo().username}
   • Pasta: ${os.homedir()}
`;
}

function formatUptime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

module.exports = { handlePrompt };
