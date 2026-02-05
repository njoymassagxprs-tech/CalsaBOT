/**
 * 🎤 CalsaBOT Voice Server
 * 
 * Interface web de voz - funciona em qualquer dispositivo
 */

require('dotenv').config();
const express = require('express');
const path = require('path');
const orchestrator = require('../orchestrator/orchestrator');

const app = express();
const PORT = process.env.VOICE_PORT || 3001;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// CORS para permitir acesso de outros dispositivos
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
});

// ═══════════════════════════════════════════════════════════
// ROTAS
// ═══════════════════════════════════════════════════════════

// Página principal
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// API para processar mensagens
app.post('/api/chat', async (req, res) => {
  try {
    const { message, userId } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: 'Mensagem vazia' });
    }
    
    console.log(`🎤 [${userId || 'web'}] ${message}`);
    
    const response = await orchestrator.handlePrompt(message, {
      type: 'voice-web',
      userId: userId || 'web-user',
      username: 'Voice User'
    });
    
    console.log(`🔊 Resposta: ${response.substring(0, 100)}...`);
    
    res.json({ 
      success: true, 
      response: response 
    });
    
  } catch (error) {
    console.error('Erro:', error);
    res.status(500).json({ 
      error: 'Erro ao processar',
      message: error.message 
    });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// ═══════════════════════════════════════════════════════════
// INICIAR SERVIDOR
// ═══════════════════════════════════════════════════════════

app.listen(PORT, '0.0.0.0', () => {
  const os = require('os');
  const interfaces = os.networkInterfaces();
  
  console.log('\n' + '═'.repeat(60));
  console.log('🎤 CalsaBOT Voice Server - Online!');
  console.log('═'.repeat(60));
  console.log('');
  console.log('📱 Acede de qualquer dispositivo:');
  console.log('');
  console.log(`   🖥️  Local:    http://localhost:${PORT}`);
  
  // Mostrar IPs da rede local
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        console.log(`   📱 Rede:     http://${iface.address}:${PORT}`);
      }
    }
  }
  
  console.log('');
  console.log('💡 Dica: Abre este link no telemóvel para usar por voz!');
  console.log('');
  console.log('═'.repeat(60) + '\n');
});
