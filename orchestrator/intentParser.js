function parseIntent(prompt) {
  const lower = prompt.toLowerCase();

  // PRIMEIRO: Verificar comandos de execução (têm prioridade)
  if (lower.startsWith('executar') || lower.startsWith('rodar') || lower.startsWith('run ')) {
    return { intent: 'execute_local', entities: {} };
  }

  // Criar PDF
  if (lower.includes('pdf') && (lower.includes('cria') || lower.includes('gera') || lower.includes('faz'))) {
    const folderMatch = prompt.match(/pasta\s+([\w\/\\]+)/i);
    const folder = folderMatch ? folderMatch[1] : 'Documentos/eventos';
    return { intent: 'create_pdf', entities: { folder: folder } };
  }

  // Ver logs/histórico (mas NÃO se for código com console.log)
  if ((lower.includes('log') || lower.includes('histórico') || lower.includes('historico') || lower.includes('atividade')) 
      && !lower.includes('console.log')) {
    return { intent: 'view_logs', entities: {} };
  }

  // Criar nota/tarefa
  if (lower.includes('nota') || lower.includes('tarefa') || lower.includes('lembrete') || lower.includes('todo')) {
    return { intent: 'create_note', entities: { content: prompt } };
  }

  // Listar ficheiros/pastas
  if (lower.includes('listar') || lower.includes('mostrar ficheiros') || lower.includes('ver ficheiros')) {
    return { intent: 'list_files', entities: {} };
  }

  // Código JavaScript/programação
  if (lower.startsWith('function') || lower.includes('javascript') || lower.includes('node.js') || lower.includes('código')) {
    return { intent: 'run_code', entities: {} };
  }

  // Ler/Escrever ficheiros
  if (lower.startsWith('ler') || lower.startsWith('escrever')) {
    return { intent: lower.includes('ler') ? 'read_file' : 'write_file', entities: {} };
  }

  // Info do sistema
  if (lower.includes('sistema') || lower.includes('info pc') || lower.includes('computador') || lower.includes('meu pc')) {
    return { intent: 'system_info', entities: {} };
  }

  return { intent: 'general_text', entities: {} };
}

module.exports = { parseIntent };
