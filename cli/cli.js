/**
 * CalsaBOT CLI - Interface de linha de comandos
 * 
 * Usa o orchestrator completo para processar todos os comandos
 */

require('dotenv').config();
const readline = require('readline');
const { handlePrompt } = require('../orchestrator/router');
const security = require('../orchestrator/security');

const VERSION = '1.1.0';
const userId = security.getUserId({});

// 🌙 Dark Mode - cores adaptadas para terminal escuro
const DARK_MODE = process.env.CALSABOT_DARK !== 'false'; // Ativo por defeito
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
  yellow: '\x1b[33m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  bgDark: DARK_MODE ? '\x1b[40m' : '',
  fgLight: DARK_MODE ? '\x1b[97m' : ''
};

const banner = `
${colors.bgDark}${colors.cyan}╔═══════════════════════════════════════════════════════════╗
║                    🤖 CalsaBOT CLI v${VERSION}                ║
║               Assistente Pessoal Inteligente              ║
╠═══════════════════════════════════════════════════════════╣
║  Comandos:                                                ║
║    /help     - mostrar ajuda                              ║
║    /status   - estado do sistema                          ║
║    /agents   - listar agentes                             ║
║    /limites  - ver limites de segurança                   ║
║    /kill     - encerrar tudo limpamente                   ║
║    /exit     - sair                                       ║
║                                                           ║
║  Ou escreve qualquer pergunta/comando em linguagem natural║
╚═══════════════════════════════════════════════════════════╝${colors.reset}
`;

console.log(banner);
if (DARK_MODE) console.log(`${colors.dim}🌙 Dark Mode ON (desativa com CALSABOT_DARK=false)${colors.reset}`);

security.logAction(userId, 'cli-started');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: '\n🤖 calsabot> '
});

rl.prompt();

rl.on('line', async (line) => {
  const input = line.trim();
  if (!input) return rl.prompt();

  // Comandos especiais
  if (input.toLowerCase() === '/exit' || input.toLowerCase() === '/sair') {
    console.log('\n👋 Até breve! CalsaBOT encerrado.\n');
    security.logAction(userId, 'cli-exit');
    rl.close();
    process.exit(0);
  }

  // 🛑 Kill command - encerrar tudo limpamente
  if (input.toLowerCase() === '/kill') {
    console.log('\n🛑 A encerrar CalsaBOT...');
    console.log('   ├── Guardando rate-limits...');
    security.saveRateLimits?.(); // Guardar rate-limits se disponível
    console.log('   ├── Fechando conexões...');
    security.logAction(userId, 'cli-kill');
    console.log('   └── ✅ Encerrado com sucesso.\n');
    rl.close();
    process.exit(0);
  }

  if (input.toLowerCase() === '/help' || input.toLowerCase() === '/ajuda') {
    console.log(`
📖 **Comandos disponíveis:**

  /help, /ajuda     - Mostrar esta ajuda
  /status           - Estado do sistema e APIs
  /agents           - Listar agentes disponíveis
  /limites          - Ver limites de segurança
  /exit, /sair      - Sair do CLI

📝 **Exemplos de uso:**

  "Cria um PDF sobre inteligência artificial"
  "Qual é a capital de Portugal?"
  "Ler ficheiros da pasta Documentos"
  "Executar console.log('Olá mundo')"
    `);
    return rl.prompt();
  }

  if (input.toLowerCase() === '/status') {
    const groqStatus = (process.env.GROQ_API_KEY || process.env.GROK_API_KEY) ? '✅ Configurado' : '❌ Não configurado';
    const telegramStatus = process.env.TELEGRAM_TOKEN ? '✅ Configurado' : '❌ Não configurado';
    const twilioStatus = process.env.TWILIO_ACCOUNT_SID ? '✅ Configurado' : '❌ Não configurado'; 
    const execRestantes = security.getRemainingExecutions(userId);
    
    console.log(`
📊 **Estado do Sistema:**

  🧠 Orquestrador:  ✅ Online
  🤖 Groq AI:       ${groqStatus}
  📱 Telegram:      ${telegramStatus}
  💬 WhatsApp:      ${twilioStatus}
  ⏱️ Uptime:        ${Math.floor(process.uptime())}s
  🔐 Execuções:     ${execRestantes}/${security.MAX_EXEC_PER_MIN} disponíveis
    `);
    return rl.prompt();
  }

  if (input.toLowerCase() === '/agents') {
    console.log(`
🤖 **Agentes Disponíveis:**

  🧠 aiAgent       - Perguntas e geração de texto (Groq LLM)
  📄 pdfAgent      - Criação de documentos PDF
  📁 fileAgent     - Leitura e escrita de ficheiros
  ⚡ localRunner   - Execução segura de código JavaScript
  💻 copilot       - Geração de código (em desenvolvimento)
    `);
    return rl.prompt();
  }

  if (input.toLowerCase() === '/limites') {
    console.log(`
🔐 **Limites de Segurança:**

  📁 Pastas de LEITURA permitidas:
${security.ALLOWED_READ.map(p => `     • ${p}`).join('\n')}

  📝 Pastas de ESCRITA permitidas:
${security.ALLOWED_WRITE.map(p => `     • ${p}`).join('\n')}

  ⚡ Rate Limit: ${security.MAX_EXEC_PER_MIN} execuções/minuto
  ⏱️ Timeout código: 5 segundos
  🛡️ Sandbox: Ativo (sem acesso a require, process, fs)
    `);
    return rl.prompt();
  }

  // Processar prompt via orchestrator
  console.log('\n⏳ A processar...\n');
  
  // Pausar input durante processamento
  rl.pause();
  
  try {
    const result = await handlePrompt(input, { isBot: false });
    
    // Limpar e formatar output
    const cleanResult = result.replace(/\r\n/g, '\n').trim();
    
    console.log('─'.repeat(50));
    console.log(cleanResult);
    console.log('─'.repeat(50));
  } catch (err) {
    console.error(`\n❌ Erro: ${err.message}`);
  }
  
  // Retomar input
  rl.resume();
  rl.prompt();
});

rl.on('close', () => {
  security.logAction(userId, 'cli-closed');
  process.exit(0);
});
