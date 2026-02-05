#!/usr/bin/env node
/**
 * 🤖 CalsaBOT - Setup Wizard
 * 
 * Assistente interativo de configuração
 * Guia o utilizador na criação das API keys necessárias
 */

const readline = require('readline');
const fs = require('fs');
const path = require('path');
const https = require('https');
const { exec } = require('child_process');

// ═══════════════════════════════════════════════════════════
// CONFIGURAÇÃO
// ═══════════════════════════════════════════════════════════

const CONFIG = {
  groq: {
    name: 'Groq API',
    description: 'Inteligência Artificial (LLaMA 3.3 70B)',
    url: 'https://console.groq.com/keys',
    required: true,
    envKey: 'GROQ_API_KEY',
    pattern: /^gsk_[a-zA-Z0-9]{40,}$/,
    instructions: [
      '1. Cria conta (ou faz login com Google/GitHub)',
      '2. No dashboard, clica em "Create API Key"',
      '3. Dá um nome (ex: "CalsaBOT")',
      '4. Copia a chave que começa com "gsk_"'
    ]
  },
  telegram: {
    name: 'Telegram Bot',
    description: 'Bot para Telegram',
    url: 'https://t.me/BotFather',
    required: false,
    envKey: 'TELEGRAM_BOT_TOKEN',
    pattern: /^\d{8,12}:[A-Za-z0-9_-]{35,}$/,
    instructions: [
      '1. Abre o BotFather no Telegram',
      '2. Envia o comando /newbot',
      '3. Escolhe um nome para o bot',
      '4. Escolhe um username (deve terminar em "bot")',
      '5. Copia o token que ele te envia'
    ]
  },
  twilio_sid: {
    name: 'Twilio Account SID',
    description: 'WhatsApp via Twilio',
    url: 'https://console.twilio.com',
    required: false,
    envKey: 'TWILIO_ACCOUNT_SID',
    pattern: /^AC[a-f0-9]{32}$/,
    instructions: [
      '1. Cria conta no Twilio (trial grátis)',
      '2. No dashboard, copia o "Account SID"',
      '3. Começa com "AC" seguido de 32 caracteres'
    ]
  },
  twilio_token: {
    name: 'Twilio Auth Token',
    description: 'Token de autenticação Twilio',
    url: null,
    required: false,
    envKey: 'TWILIO_AUTH_TOKEN',
    pattern: /^[a-f0-9]{32}$/,
    instructions: [
      '1. No mesmo dashboard do Twilio',
      '2. Copia o "Auth Token"',
      '3. São 32 caracteres hexadecimais'
    ]
  },
  twilio_number: {
    name: 'Twilio WhatsApp Number',
    description: 'Número WhatsApp Twilio',
    url: 'https://console.twilio.com/us1/develop/sms/try-it-out/whatsapp-learn',
    required: false,
    envKey: 'TWILIO_WHATSAPP_NUMBER',
    pattern: /^whatsapp:\+\d{10,15}$/,
    instructions: [
      '1. Ativa o WhatsApp Sandbox no Twilio',
      '2. O número é no formato: whatsapp:+14155238886',
      '3. (O número do sandbox é sempre o mesmo)'
    ]
  },
  reddit_client_id: {
    name: 'Reddit Client ID',
    description: 'Bot/App Reddit',
    url: 'https://www.reddit.com/prefs/apps',
    required: false,
    envKey: 'REDDIT_CLIENT_ID',
    pattern: /^[a-zA-Z0-9_-]{14,30}$/,
    instructions: [
      '1. Vai a reddit.com/prefs/apps',
      '2. Clica "create another app..."',
      '3. Nome: CalsaBOT, Tipo: script',
      '4. Redirect URI: http://localhost:8080',
      '5. Copia o ID abaixo do nome da app'
    ]
  },
  reddit_secret: {
    name: 'Reddit Client Secret',
    description: 'Secret da App Reddit',
    url: null,
    required: false,
    envKey: 'REDDIT_CLIENT_SECRET',
    pattern: /^[a-zA-Z0-9_-]{20,40}$/,
    instructions: [
      '1. Na mesma página da app Reddit',
      '2. Copia o "secret" (abaixo do client ID)'
    ]
  },
  reddit_username: {
    name: 'Reddit Username',
    description: 'Teu username Reddit',
    url: null,
    required: false,
    envKey: 'REDDIT_USERNAME',
    pattern: /^[a-zA-Z0-9_-]{3,20}$/,
    instructions: [
      '1. O teu username do Reddit (sem u/)'
    ]
  },
  reddit_password: {
    name: 'Reddit Password',
    description: 'Password da conta Reddit',
    url: null,
    required: false,
    envKey: 'REDDIT_PASSWORD',
    pattern: /^.{6,}$/,
    instructions: [
      '1. A password da tua conta Reddit',
      '⚠️ Recomendado: Usa uma conta secundária para bots'
    ]
  },
  openai: {
    name: 'OpenAI API',
    description: 'GPT-4 / ChatGPT (Opcional)',
    url: 'https://platform.openai.com/api-keys',
    required: false,
    envKey: 'OPENAI_API_KEY',
    pattern: /^sk-(?:proj-)?[a-zA-Z0-9\-_]{20,}$/,
    instructions: [
      '1. Cria conta na OpenAI',
      '2. Vai a API Keys',
      '3. Clica "Create new secret key"',
      '4. Copia a chave que começa com "sk-"',
      '⚠️ NOTA: OpenAI é PAGO (não tem tier grátis)'
    ]
  }
};

// ═══════════════════════════════════════════════════════════
// CORES E FORMATAÇÃO
// ═══════════════════════════════════════════════════════════

const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m'
};

const c = {
  ok: (t) => `${colors.green}${t}${colors.reset}`,
  err: (t) => `${colors.red}${t}${colors.reset}`,
  warn: (t) => `${colors.yellow}${t}${colors.reset}`,
  info: (t) => `${colors.cyan}${t}${colors.reset}`,
  bold: (t) => `${colors.bold}${t}${colors.reset}`,
  dim: (t) => `${colors.dim}${t}${colors.reset}`
};

// ═══════════════════════════════════════════════════════════
// UTILIDADES
// ═══════════════════════════════════════════════════════════

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function ask(question) {
  return new Promise(resolve => {
    rl.question(question, answer => resolve(answer.trim()));
  });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function clearScreen() {
  console.clear();
}

function line(char = '─', length = 60) {
  return char.repeat(length);
}

function box(title, content = []) {
  const width = 60;
  const border = '═';
  
  console.log('\n' + c.cyan('╔' + border.repeat(width - 2) + '╗'));
  console.log(c.cyan('║') + title.padStart((width + title.length) / 2 - 1).padEnd(width - 2) + c.cyan('║'));
  console.log(c.cyan('╠' + border.repeat(width - 2) + '╣'));
  
  for (const line of content) {
    const paddedLine = '  ' + line;
    console.log(c.cyan('║') + paddedLine.padEnd(width - 2) + c.cyan('║'));
  }
  
  console.log(c.cyan('╚' + border.repeat(width - 2) + '╝'));
}

// Abrir URL no browser (cross-platform)
function openUrl(url) {
  const platform = process.platform;
  let command;
  
  if (platform === 'win32') {
    command = `start "" "${url}"`;
  } else if (platform === 'darwin') {
    command = `open "${url}"`;
  } else {
    command = `xdg-open "${url}"`;
  }
  
  return new Promise((resolve, reject) => {
    exec(command, (error) => {
      if (error) {
        console.log(c.warn(`  ⚠️ Não foi possível abrir o browser automaticamente`));
        console.log(c.info(`  📋 Abre manualmente: ${url}`));
      }
      resolve();
    });
  });
}

// Validar API key da Groq
async function validateGroqKey(key) {
  return new Promise((resolve) => {
    const options = {
      hostname: 'api.groq.com',
      path: '/openai/v1/models',
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${key}`
      }
    };
    
    const req = https.request(options, (res) => {
      resolve(res.statusCode === 200);
    });
    
    req.on('error', () => resolve(false));
    req.setTimeout(5000, () => {
      req.destroy();
      resolve(false);
    });
    
    req.end();
  });
}

// Validar token do Telegram
async function validateTelegramToken(token) {
  return new Promise((resolve) => {
    const options = {
      hostname: 'api.telegram.org',
      path: `/bot${token}/getMe`,
      method: 'GET'
    };
    
    const req = https.request(options, (res) => {
      resolve(res.statusCode === 200);
    });
    
    req.on('error', () => resolve(false));
    req.setTimeout(5000, () => {
      req.destroy();
      resolve(false);
    });
    
    req.end();
  });
}

// ═══════════════════════════════════════════════════════════
// SETUP STEPS
// ═══════════════════════════════════════════════════════════

const envConfig = {};

async function setupService(key, stepNum, totalSteps) {
  const service = CONFIG[key];
  
  console.log('\n' + c.bold(line('━')));
  console.log(c.bold(`\n📌 PASSO ${stepNum}/${totalSteps}: ${service.name}`));
  console.log(c.dim(`   ${service.description}`));
  
  if (!service.required) {
    const wantSetup = await ask(`\n   Queres configurar ${service.name}? (s/n): `);
    if (wantSetup.toLowerCase() !== 's' && wantSetup.toLowerCase() !== 'sim') {
      console.log(c.dim(`   ⏭️ A saltar ${service.name}...`));
      return null;
    }
  } else {
    console.log(c.warn(`\n   ⚠️ Este serviço é OBRIGATÓRIO para o bot funcionar!`));
  }
  
  // Mostrar instruções
  console.log(c.info('\n   📖 Instruções:'));
  for (const instruction of service.instructions) {
    console.log(c.dim(`      ${instruction}`));
  }
  
  // Abrir URL
  if (service.url) {
    console.log(c.info(`\n   🌐 URL: ${service.url}`));
    await ask(c.dim('   [Pressiona Enter para abrir no browser...]'));
    await openUrl(service.url);
    await sleep(1000);
  }
  
  // Pedir a key
  let isValid = false;
  let attempts = 0;
  let value;
  
  while (!isValid && attempts < 3) {
    attempts++;
    value = await ask(c.bold(`\n   🔑 Cola aqui a tua ${service.name} key: `));
    
    if (!value) {
      if (service.required) {
        console.log(c.err('   ❌ Esta chave é obrigatória!'));
        continue;
      } else {
        console.log(c.dim('   ⏭️ A saltar...'));
        return null;
      }
    }
    
    // Validar formato
    if (!service.pattern.test(value)) {
      console.log(c.err('   ❌ Formato inválido! Verifica se copiaste corretamente.'));
      console.log(c.dim(`   💡 Dica: A chave deve corresponder ao padrão esperado`));
      continue;
    }
    
    // Validar online (apenas para Groq e Telegram)
    console.log(c.dim('   ⏳ A verificar...'));
    
    if (key === 'groq') {
      isValid = await validateGroqKey(value);
    } else if (key === 'telegram') {
      isValid = await validateTelegramToken(value);
    } else {
      // Para outros serviços, aceitar se o formato está correto
      isValid = true;
    }
    
    if (!isValid) {
      console.log(c.err('   ❌ Chave inválida ou erro de conexão! Tenta novamente.'));
    }
  }
  
  if (isValid) {
    console.log(c.ok(`   ✅ ${service.name} configurado com sucesso!`));
    envConfig[service.envKey] = value;
    return value;
  } else if (service.required) {
    console.log(c.err(`\n   ❌ Falhou após ${attempts} tentativas. O setup não pode continuar.`));
    process.exit(1);
  }
  
  return null;
}

// ═══════════════════════════════════════════════════════════
// GUARDAR .ENV
// ═══════════════════════════════════════════════════════════

function saveEnvFile() {
  const envPath = path.join(process.cwd(), '.env');
  const backupPath = path.join(process.cwd(), '.env.backup');
  
  // Backup se existir
  if (fs.existsSync(envPath)) {
    fs.copyFileSync(envPath, backupPath);
    console.log(c.dim(`   📦 Backup criado: .env.backup`));
  }
  
  // Gerar conteúdo
  let content = `# ══════════════════════════════════════════════════════════
# CalsaBOT - Configuração
# Gerado automaticamente em ${new Date().toLocaleString('pt-PT')}
# ══════════════════════════════════════════════════════════

`;

  // Groq
  if (envConfig.GROQ_API_KEY) {
    content += `# Groq API - Inteligência Artificial
GROQ_API_KEY=${envConfig.GROQ_API_KEY}

`;
  }
  
  // Telegram
  if (envConfig.TELEGRAM_BOT_TOKEN) {
    content += `# Telegram Bot
TELEGRAM_BOT_TOKEN=${envConfig.TELEGRAM_BOT_TOKEN}

`;
  }
  
  // Twilio
  if (envConfig.TWILIO_ACCOUNT_SID) {
    content += `# Twilio WhatsApp
TWILIO_ACCOUNT_SID=${envConfig.TWILIO_ACCOUNT_SID}
TWILIO_AUTH_TOKEN=${envConfig.TWILIO_AUTH_TOKEN || ''}
TWILIO_WHATSAPP_NUMBER=${envConfig.TWILIO_WHATSAPP_NUMBER || ''}

`;
  }
  
  // OpenAI
  if (envConfig.OPENAI_API_KEY) {
    content += `# OpenAI (Opcional)
OPENAI_API_KEY=${envConfig.OPENAI_API_KEY}

`;
  }
  
  // Reddit
  if (envConfig.REDDIT_CLIENT_ID) {
    content += `# Reddit Bot
REDDIT_CLIENT_ID=${envConfig.REDDIT_CLIENT_ID}
REDDIT_CLIENT_SECRET=${envConfig.REDDIT_CLIENT_SECRET || ''}
REDDIT_USERNAME=${envConfig.REDDIT_USERNAME || ''}
REDDIT_PASSWORD=${envConfig.REDDIT_PASSWORD || ''}

`;
  }
  
  fs.writeFileSync(envPath, content, 'utf-8');
  console.log(c.ok(`   ✅ Ficheiro .env criado com sucesso!`));
}

// ═══════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════

async function main() {
  clearScreen();
  
  box('🤖 CalsaBOT - Assistente de Instalação', [
    '',
    'Olá! Vou ajudar-te a configurar o CalsaBOT.',
    '',
    'Precisas de criar algumas API keys (a maioria é grátis!)',
    '',
    'Vou abrir os sites necessários e guiar-te passo a passo.',
    ''
  ]);
  
  console.log('\n');
  
  // Verificar se já existe .env
  const envPath = path.join(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    console.log(c.warn('⚠️ Já existe um ficheiro .env!'));
    const overwrite = await ask('   Queres substituir? (s/n): ');
    if (overwrite.toLowerCase() !== 's' && overwrite.toLowerCase() !== 'sim') {
      console.log(c.dim('   A manter configuração existente.'));
      rl.close();
      return;
    }
  }
  
  // Perguntar modo
  console.log(c.bold('\n📋 Escolhe o modo de instalação:\n'));
  console.log('   1. ' + c.ok('Rápido') + ' - Apenas Groq (mínimo para funcionar)');
  console.log('   2. ' + c.info('Telegram') + ' - Groq + Telegram Bot');
  console.log('   3. ' + c.warn('Completo') + ' - Todas as integrações');
  
  const mode = await ask('\n   Opção (1/2/3): ');
  
  let steps = ['groq'];
  
  if (mode === '2') {
    steps = ['groq', 'telegram'];
  } else if (mode === '3') {
    steps = ['groq', 'telegram', 'twilio_sid', 'twilio_token', 'twilio_number', 'reddit_client_id', 'reddit_secret', 'reddit_username', 'reddit_password', 'openai'];
  }
  
  // Executar steps
  const totalSteps = steps.length;
  
  for (let i = 0; i < steps.length; i++) {
    await setupService(steps[i], i + 1, totalSteps);
  }
  
  // Guardar .env
  console.log('\n' + c.bold(line('━')));
  console.log(c.bold('\n💾 A guardar configuração...\n'));
  saveEnvFile();
  
  // Sumário final
  console.log('\n' + c.bold(line('═')));
  console.log(c.ok(c.bold('\n✅ INSTALAÇÃO COMPLETA!\n')));
  
  console.log('   Serviços configurados:');
  console.log(`   ${envConfig.GROQ_API_KEY ? '✅' : '⬚'} Groq AI`);
  console.log(`   ${envConfig.TELEGRAM_BOT_TOKEN ? '✅' : '⬚'} Telegram Bot`);
  console.log(`   ${envConfig.TWILIO_ACCOUNT_SID ? '✅' : '⬚'} WhatsApp (Twilio)`);
  console.log(`   ${envConfig.OPENAI_API_KEY ? '✅' : '⬚'} OpenAI`);
  
  console.log(c.bold('\n   Para iniciar o CalsaBOT:\n'));
  console.log(c.info('   • CLI:      ') + 'npm run cli');
  if (envConfig.TELEGRAM_BOT_TOKEN) {
    console.log(c.info('   • Telegram: ') + 'npm run telegram');
  }
  if (envConfig.TWILIO_ACCOUNT_SID) {
    console.log(c.info('   • WhatsApp: ') + 'npm run whatsapp');
  }
  
  // Mensagem de apoio
  console.log('\n' + c.dim(line('─')));
  console.log(c.bold('\n   ☕ Gostaste do CalsaBOT?\n'));
  console.log('   Se foi útil, considera apoiar o projeto:');
  console.log(c.info('   💳 https://buy.stripe.com/cNicN5c2neYg7FPbAyes004'));
  console.log(c.dim('\n   O teu apoio ajuda a manter o desenvolvimento! 🙏'));
  
  console.log(c.bold('\n   Diverte-te! 🎉\n'));
  
  rl.close();
}

// Run
main().catch(err => {
  console.error(c.err(`\n❌ Erro: ${err.message}\n`));
  rl.close();
  process.exit(1);
});
