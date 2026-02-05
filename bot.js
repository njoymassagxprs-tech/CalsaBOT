/**
 * CalsaBOT - Bot Telegram
 * 
 * Interface Telegram para o CalsaBOT
 */

require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const router = require('./orchestrator/router');
const security = require('./orchestrator/security');

// ───── CONFIGURAÇÃO ─────
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;

if (!TELEGRAM_TOKEN) {
  console.error('❌ Token do Telegram não encontrado no .env');
  process.exit(1);
}

const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });
console.log('🤖 CalsaBOT Telegram ativo e escutando mensagens...');
security.logAction('system', 'telegram-bot-started');

// ───── COMANDOS BÁSICOS ─────
bot.onText(/\/start/, (msg) => {
  bot.sendMessage(msg.chat.id, '🚀 CalSaBot online.\nEnvie um prompt para eu processar ou use /help.')
})

bot.onText(/\/help/, (msg) => {
  bot.sendMessage(msg.chat.id, `
📖 Comandos disponíveis:
/start - iniciar o bot
/status - estado do sistema
/agents - listar agentes disponíveis
/help - esta ajuda
Qualquer outro texto será processado pelo CalSaBot
  `)
})

bot.onText(/\/status/, (msg) => {
  const status = `
🧠 Orquestrador: online
🤖 Groq: ${process.env.GROQ_API_KEY ? 'ligado' : 'desligado'}
⚙️ Automações: simuladas
⏱️ Uptime: ${Math.floor(process.uptime())}s
  `
  bot.sendMessage(msg.chat.id, status)
})

bot.onText(/\/agents/, (msg) => {
  const agents = [
    'groq — raciocínio e geração de texto',
    'copilot — geração de código / miniapps',
    'local-runner — execução de scripts locais',
    'pdf-agent — criação de PDFs',
    'data-collector — coleta de dados locais'
  ]
  bot.sendMessage(msg.chat.id, `🤖 Agentes disponíveis:\n• ${agents.join('\n• ')}`)
})

// ───── HANDLER DE MENSAGENS ─────
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text || '';
  const userId = `telegram:${chatId}`;

  // Ignorar comandos já tratados
  if (text.startsWith('/')) return;

  console.log(`[PROMPT Telegram] ${userId}: ${text}`);
  security.logAction(userId, 'message-received', { text: text.substring(0, 100) });
  
  bot.sendMessage(chatId, '🤔 A processar a tarefa...');

  try {
    // Passar contexto com identificação do utilizador
    const context = { 
      telegramChatId: chatId,
      isBot: true  // Execuções em bots pulam confirmação manual
    };
    const result = await router.handlePrompt(text, context);
    bot.sendMessage(chatId, result);
  } catch (err) {
    security.logAction(userId, 'error', { error: err.message });
    bot.sendMessage(chatId, `❌ Erro ao processar: ${err.message || err}`);
  }
});
