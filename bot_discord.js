/**
 * 🎮 CalsaBOT - Discord Bot
 * 
 * Bot Discord com integração ao CalsaBOT
 * Permite que utilizadores interajam com a IA no Discord
 */

require('dotenv').config();
const { Client, GatewayIntentBits, Partials, EmbedBuilder } = require('discord.js');
const router = require('./orchestrator/router');

// Verificar token
const TOKEN = process.env.DISCORD_BOT_TOKEN;
if (!TOKEN) {
  console.error('❌ DISCORD_BOT_TOKEN não encontrado no .env!');
  console.error('   Adiciona: DISCORD_BOT_TOKEN=teu_token');
  process.exit(1);
}

// Criar cliente Discord
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// Prefixo para comandos (opcional, também responde a menções)
const PREFIX = '!calsa';

// ═══════════════════════════════════════════════════════════
// EVENTOS
// ═══════════════════════════════════════════════════════════

client.once('ready', () => {
  console.log('');
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║           🎮 CalsaBOT Discord - Online!                  ║');
  console.log('╠══════════════════════════════════════════════════════════╣');
  console.log(`║  Bot: ${client.user.tag.padEnd(47)}║`);
  console.log(`║  Servidores: ${String(client.guilds.cache.size).padEnd(41)}║`);
  console.log(`║  Prefixo: ${PREFIX.padEnd(44)}║`);
  console.log('╠══════════════════════════════════════════════════════════╣');
  console.log('║  Comandos:                                               ║');
  console.log('║    !calsa [pergunta]  - Perguntar à IA                   ║');
  console.log('║    !calsa pdf [tema]  - Criar PDF                        ║');
  console.log('║    !calsa help        - Ver ajuda                        ║');
  console.log('║    @CalsaBOT [msg]    - Mencionar o bot                  ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log('');
  
  // Definir status
  client.user.setActivity('!calsa help | 🤖 IA', { type: 'LISTENING' });
});

client.on('messageCreate', async (message) => {
  // Ignorar mensagens do próprio bot
  if (message.author.bot) return;
  
  // Verificar se é comando ou menção
  const isMention = message.mentions.has(client.user);
  const isCommand = message.content.toLowerCase().startsWith(PREFIX);
  
  if (!isMention && !isCommand) return;
  
  // Extrair conteúdo da mensagem
  let content = message.content;
  
  if (isCommand) {
    content = content.slice(PREFIX.length).trim();
  } else if (isMention) {
    content = content.replace(/<@!?\d+>/g, '').trim();
  }
  
  // Se vazio, mostrar ajuda
  if (!content) {
    return sendHelp(message);
  }
  
  // Comandos especiais
  const lowerContent = content.toLowerCase();
  
  if (lowerContent === 'help' || lowerContent === 'ajuda') {
    return sendHelp(message);
  }
  
  if (lowerContent === 'ping') {
    return message.reply(`🏓 Pong! Latência: ${client.ws.ping}ms`);
  }
  
  if (lowerContent === 'info' || lowerContent === 'about') {
    return sendInfo(message);
  }
  
  // Processar com CalsaBOT
  try {
    // Mostrar que está a processar
    await message.channel.sendTyping();
    
    // Contexto do Discord
    const context = {
      type: 'discord',
      discordUserId: message.author.id,
      discordUsername: message.author.username,
      discordGuildId: message.guild?.id,
      discordChannelId: message.channel.id,
    };
    
    // Processar prompt
    const response = await router.handlePrompt(content, context);
    
    // Enviar resposta
    if (response.length > 2000) {
      // Discord tem limite de 2000 caracteres
      const chunks = splitMessage(response, 2000);
      for (const chunk of chunks) {
        await message.reply(chunk);
      }
    } else {
      await message.reply(response);
    }
    
  } catch (error) {
    console.error('Erro ao processar mensagem:', error);
    await message.reply('❌ Ocorreu um erro ao processar o pedido. Tenta novamente.');
  }
});

// ═══════════════════════════════════════════════════════════
// FUNÇÕES AUXILIARES
// ═══════════════════════════════════════════════════════════

function sendHelp(message) {
  const embed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle('🤖 CalsaBOT - Ajuda')
    .setDescription('Assistente pessoal inteligente com IA')
    .addFields(
      { name: '💬 Perguntar à IA', value: '`!calsa Como funciona o JavaScript?`', inline: false },
      { name: '📄 Criar PDF', value: '`!calsa criar pdf sobre Node.js`', inline: false },
      { name: '📋 Criar Nota', value: '`!calsa criar nota lembrete reunião`', inline: false },
      { name: '💻 Info Sistema', value: '`!calsa info sistema`', inline: false },
      { name: '📁 Listar Ficheiros', value: '`!calsa listar ficheiros`', inline: false },
      { name: '🏓 Ping', value: '`!calsa ping`', inline: true },
      { name: 'ℹ️ Info', value: '`!calsa info`', inline: true },
    )
    .setFooter({ text: 'Também podes mencionar @CalsaBOT diretamente!' })
    .setTimestamp();
  
  return message.reply({ embeds: [embed] });
}

function sendInfo(message) {
  const embed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle('🤖 CalsaBOT')
    .setDescription('Assistente pessoal inteligente powered by Groq AI')
    .addFields(
      { name: '🧠 IA', value: 'LLaMA 3.3 70B via Groq', inline: true },
      { name: '📊 Servidores', value: String(client.guilds.cache.size), inline: true },
      { name: '⏱️ Uptime', value: formatUptime(client.uptime), inline: true },
      { name: '🔗 GitHub', value: '[CalsaBOT](https://github.com/njoymassagxprs-tech/CalsaBOT)', inline: false },
      { name: '☕ Apoiar', value: '[Stripe](https://buy.stripe.com/cNicN5c2neYg7FPbAyes004)', inline: false },
    )
    .setTimestamp();
  
  return message.reply({ embeds: [embed] });
}

function splitMessage(text, maxLength) {
  const chunks = [];
  let current = '';
  
  const lines = text.split('\n');
  for (const line of lines) {
    if ((current + line + '\n').length > maxLength) {
      if (current) chunks.push(current.trim());
      current = line + '\n';
    } else {
      current += line + '\n';
    }
  }
  
  if (current.trim()) {
    chunks.push(current.trim());
  }
  
  return chunks;
}

function formatUptime(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

// ═══════════════════════════════════════════════════════════
// INICIAR BOT
// ═══════════════════════════════════════════════════════════

client.login(TOKEN).catch((error) => {
  console.error('❌ Erro ao fazer login no Discord:');
  console.error(error.message);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 A desligar CalsaBOT Discord...');
  client.destroy();
  process.exit(0);
});
