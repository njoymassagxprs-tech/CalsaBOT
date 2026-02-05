#!/bin/bash

echo ""
echo "╔═══════════════════════════════════════════════════════════╗"
echo "║           🤖 CalsaBOT - Instalador Linux/Mac              ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo ""

# Verificar Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js não encontrado!"
    echo "   Instala em: https://nodejs.org/"
    echo "   Ou usa: curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt-get install -y nodejs"
    exit 1
fi

echo "✅ Node.js encontrado: $(node --version)"
echo ""

# Instalar dependências
echo "📦 A instalar dependências..."
npm install
echo ""

# Verificar .env
if [ ! -f .env ]; then
    echo ""
    echo "🔧 Ficheiro .env não encontrado!"
    echo "   A iniciar assistente de configuração..."
    echo ""
    npm run setup
else
    echo "✅ Ficheiro .env encontrado"
    echo ""
    read -p "   Queres reconfigurar? (s/n): " RECONFIG
    if [ "$RECONFIG" = "s" ] || [ "$RECONFIG" = "S" ]; then
        npm run setup
    fi
fi

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "✅ Instalação concluída!"
echo ""
echo "Para iniciar o CalsaBOT:"
echo "   npm run cli       - Interface de linha de comandos"
echo "   npm run telegram  - Bot Telegram"
echo "   npm run whatsapp  - Bot WhatsApp"
echo ""
echo "═══════════════════════════════════════════════════════════"
