/**
 * File Agent - Gestão segura de ficheiros
 * 
 * Usa o módulo de segurança para validar caminhos
 */

const fs = require('fs');
const path = require('path');
const security = require('../orchestrator/security');

async function handleFile(intentData, userId = 'unknown') {
  try {
    if (intentData.intent === 'read_file') {
      // Listar ficheiros do diretório de outputs/documentos
      const docsPath = path.join(__dirname, '..', 'Documentos');
      const outputsPath = path.join(__dirname, '..', 'outputs');
      
      let result = '📂 **Ficheiros disponíveis:**\n\n';
      
      // Listar Documentos
      if (fs.existsSync(docsPath)) {
        const docs = listDirRecursive(docsPath, 'Documentos');
        result += `📁 Documentos/\n${docs}\n`;
      }
      
      // Listar Outputs
      if (fs.existsSync(outputsPath)) {
        const outputs = listDirRecursive(outputsPath, 'outputs');
        result += `\n📁 outputs/\n${outputs}`;
      }
      
      security.logAction(userId, 'file-list', { paths: [docsPath, outputsPath] });
      return result || '📂 Nenhum ficheiro encontrado nas pastas autorizadas.';
      
    } else if (intentData.intent === 'write_file') {
      // Criar ficheiro de exemplo na pasta outputs
      const fileName = `ficheiro_${Date.now()}.txt`;
      const filePath = path.join(__dirname, '..', 'outputs', fileName);
      
      // Usar escrita segura
      const content = intentData.entities?.content || 'Conteúdo de teste do File Agent\nCriado pelo CalsaBOT';
      security.safeWriteFile(filePath, content);
      
      security.logAction(userId, 'file-created', { path: filePath });
      return `📝 Ficheiro criado: ${filePath}`;
      
    } else {
      return '❌ Operação de ficheiro não reconhecida.';
    }
  } catch (err) {
    security.logAction(userId, 'file-error', { error: err.message });
    return `❌ Erro File Agent: ${err.message}`;
  }
}

// Função auxiliar para listar diretório recursivamente (limitado a 2 níveis)
function listDirRecursive(dirPath, prefix = '', level = 0) {
  if (level > 2) return '';
  
  let result = '';
  try {
    const items = fs.readdirSync(dirPath);
    
    for (const item of items) {
      const itemPath = path.join(dirPath, item);
      const stat = fs.statSync(itemPath);
      const indent = '  '.repeat(level + 1);
      
      if (stat.isDirectory()) {
        result += `${indent}📁 ${item}/\n`;
        result += listDirRecursive(itemPath, prefix, level + 1);
      } else {
        const size = formatFileSize(stat.size);
        result += `${indent}📄 ${item} (${size})\n`;
      }
    }
  } catch (err) {
    result += `  ⚠️ Erro ao ler: ${err.message}\n`;
  }
  
  return result;
}

function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

module.exports = { handleFile };
