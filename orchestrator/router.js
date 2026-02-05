/**
 * Router - Ponto de entrada para todos os canais (Telegram, WhatsApp, CLI)
 * Encaminha prompts para o orchestrator principal
 */

const orchestrator = require('./orchestrator');

module.exports = {
  handlePrompt: orchestrator.handlePrompt
};
