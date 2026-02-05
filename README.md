# 🤖 CalsaBOT

**Assistente Pessoal Inteligente** com integração Telegram, WhatsApp e CLI.

Usa IA (Groq/LLaMA) para responder perguntas, criar PDFs, executar código e muito mais!

---

## ✨ Funcionalidades

| Funcionalidade | Descrição |
|----------------|-----------|
| 🧠 **Chat IA** | Respostas inteligentes via Groq (LLaMA 3.3 70B) |
| 📄 **Criar PDFs** | Gera documentos PDF com conteúdo AI |
| 🎤 **Interface Voz** | Fala com o bot - funciona em qualquer dispositivo! |
| 📱 **Telegram Bot** | Interface via Telegram |
| 💬 **WhatsApp Bot** | Interface via Twilio WhatsApp |
| 🎮 **Discord Bot** | Interface via Discord |
| 🤖 **Reddit Bot** | Integração com Reddit API |
| 💻 **CLI** | Interface de linha de comandos |
| ⚡ **Executar Código** | Executa JavaScript em sandbox segura |
| 📁 **Gestão Ficheiros** | Cria notas, lista ficheiros |
| 🔐 **Segurança** | Rate limiting, whitelist de pastas, logs |

---

## 🚀 Instalação Rápida

### Pré-requisitos

- [Node.js](https://nodejs.org/) 18 ou superior
- Conta [Groq](https://console.groq.com/) (grátis) para API de IA
- (Opcional) Bot Telegram via [@BotFather](https://t.me/BotFather)
- (Opcional) Conta [Twilio](https://www.twilio.com/) para WhatsApp

### 1. Clonar o Repositório

```bash
git clone https://github.com/SEU_USUARIO/CalsaBOT.git
cd CalsaBOT
```

### 2. Instalar Dependências

```bash
npm install
```

### 3. Configurar Variáveis de Ambiente

Copia o ficheiro de exemplo e edita com as tuas chaves:

```bash
cp .env.example .env
```

Edita o ficheiro `.env`:

```env
# Obrigatório - Groq AI (https://console.groq.com/)
GROQ_API_KEY=gsk_xxxxxxxxxxxxx

# Opcional - Telegram Bot
TELEGRAM_TOKEN=123456789:ABCdefGHIjklMNOpqrsTUVwxyz

# Opcional - WhatsApp (Twilio)
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxx
TWILIO_WHATSAPP_NUMBER=whatsapp:+1234567890
PORT=3000
```

### 4. Executar

```bash
# CLI (recomendado para testar)
npm run cli

# Bot Telegram
npm run start-telegram

# Bot WhatsApp
npm run start-whatsapp
```

---

## 📖 Como Usar

### CLI

```
🤖 calsabot> Qual é a capital de Portugal?
🧠 A capital de Portugal é Lisboa!

🤖 calsabot> Cria um PDF sobre inteligência artificial
📄 PDF criado: Documentos/eventos/pdf_123456.pdf

🤖 calsabot> Executar: console.log(2 + 2)
✅ Resultado: 4

🤖 calsabot> /status
📊 Estado do Sistema...
```

### Comandos Disponíveis

| Comando | Descrição |
|---------|-----------|
| `/help` | Mostrar ajuda |
| `/status` | Estado do sistema |
| `/agents` | Listar agentes disponíveis |
| `/limites` | Ver limites de segurança |
| `/exit` | Sair do CLI |

### Exemplos de Prompts

- `Cria um PDF sobre cavalos`
- `Qual é a população de Portugal?`
- `Criar nota comprar pão`
- `Listar ficheiros`
- `Ver histórico`
- `Info do sistema`
- `Executar: Math.random()`

---

## 🔐 Segurança

O CalsaBOT implementa várias camadas de segurança:

- ✅ **Whitelist de pastas** - Só acede a Documentos/, outputs/, temp/
- ✅ **Rate limiting** - Máximo 5 execuções de código por minuto
- ✅ **Sandbox** - Código executa em VM isolada sem acesso a fs/require
- ✅ **Timeout** - Código tem máximo 5 segundos de execução
- ✅ **Confirmação** - Pede confirmação antes de executar código
- ✅ **Logs** - Todas as ações são registadas

---

## 📁 Estrutura do Projeto

```
CalsaBOT/
├── bot.js              # Bot Telegram
├── bot_whatsapp.js     # Bot WhatsApp
├── cli/
│   └── cli.js          # Interface CLI
├── orchestrator/
│   ├── router.js       # Router principal
│   ├── orchestrator.js # Cérebro do bot
│   ├── intentParser.js # Analisador de intenções
│   └── security.js     # Módulo de segurança
├── agents/
│   ├── aiAgents.js     # Integração Groq AI
│   ├── pdfAgent.js     # Criação de PDFs
│   ├── fileAgent.js    # Gestão de ficheiros
│   └── localRunner.js  # Execução de código
├── Documentos/         # PDFs e notas gerados
├── outputs/            # Ficheiros de output
├── memory/             # Logs de interações
└── temp/               # Ficheiros temporários
```

---

## 🛠️ Desenvolvimento

### Adicionar Novo Agente

1. Criar ficheiro em `agents/meuAgente.js`
2. Adicionar intenção em `orchestrator/intentParser.js`
3. Adicionar handler em `orchestrator/orchestrator.js`

### Testar

```bash
npm run cli
```

---

## 📝 Licença

MIT License - Livre para usar, modificar e distribuir.

---

## 👤 Autor

Desenvolvido por **Diabo**

---

## 🤝 Contribuições

Contribuições são bem-vindas! Abre um Issue ou Pull Request.

---

## ☕ Apoiar o Projeto

Se o CalsaBOT te foi útil, considera apoiar o desenvolvimento:

[![Apoiar com Stripe](https://img.shields.io/badge/💳_Apoiar-CalsaBOT-635bff?style=for-the-badge)](https://buy.stripe.com/cNicN5c2neYg7FPbAyes004)

O teu apoio ajuda a manter o projeto ativo e a desenvolver novas funcionalidades! 🙏

---

## ⭐ Se gostaste, deixa uma estrela!
