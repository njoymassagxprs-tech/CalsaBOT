/**
 * PDF Agent - Criação de documentos PDF
 * 
 * Usa o AI Agent para gerar conteúdo e PDFKit para criar o ficheiro
 */

const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const aiAgent = require('./aiAgents'); // Corrigido: aiAgents com 's'
const security = require('../orchestrator/security');

async function createPDF(prompt, folder = null) {
  let content = '';
  const userId = security.getUserId({});
  
  // Garantir que folder nunca é null
  const targetFolder = folder || 'Documentos/eventos';

  // Tenta gerar com Groq
  try {
    security.logAction(userId, 'pdf-generate-start', { prompt: prompt.substring(0, 100) });
    content = await aiAgent.generateContent(prompt, 'documento PDF');
    
    if (!content || content.startsWith('⚠️')) {
      throw new Error('Conteúdo vazio ou erro do Groq');
    }
  } catch (err) {
    console.warn('⚠️ Fallback ativado: Groq indisponível, usando texto padrão');
    content = generateFallback(prompt);
  }

  // Validar e criar pasta de destino
  const fileName = `pdf_${Date.now()}.pdf`;
  let finalFolder = targetFolder;
  
  // Verificar se o caminho é permitido
  try {
    const dirPath = path.resolve(targetFolder);
    security.validateFilePath(dirPath, 'write');
  } catch (err) {
    // Se não for permitido, usar pasta padrão segura
    console.warn(`⚠️ Pasta "${targetFolder}" não permitida, usando Documentos/eventos`);
    finalFolder = path.join(__dirname, '..', 'Documentos', 'eventos');
  }

  const finalDirPath = path.resolve(finalFolder);
  if (!fs.existsSync(finalDirPath)) {
    fs.mkdirSync(finalDirPath, { recursive: true });
  }

  const filePath = path.join(finalDirPath, fileName);

  // Criar PDF
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ 
        margin: 50,
        size: 'A4'
      });
      
      const stream = fs.createWriteStream(filePath);
      doc.pipe(stream);
      
      // Header
      doc.fontSize(20).font('Helvetica-Bold').text('CalsaBOT - Documento Gerado', { align: 'center' });
      doc.moveDown();
      doc.fontSize(10).font('Helvetica').text(`Gerado em: ${new Date().toLocaleString('pt-PT')}`, { align: 'center' });
      doc.moveDown(2);
      
      // Linha separadora
      doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
      doc.moveDown();
      
      // Conteúdo principal
      doc.fontSize(12).font('Helvetica').text(content, { 
        align: 'justify',
        lineGap: 4
      });
      
      // Footer
      doc.moveDown(2);
      doc.fontSize(8).fillColor('gray').text('Documento gerado automaticamente pelo CalsaBOT', { align: 'center' });
      
      doc.end();
      
      stream.on('finish', () => {
        security.logAction(userId, 'pdf-created', { path: filePath });
        resolve(filePath);
      });
      
      stream.on('error', reject);
      
    } catch (err) {
      reject(err);
    }
  });
}

// Texto padrão caso Groq falhe
function generateFallback(prompt) {
  return `DOCUMENTO GERADO (Modo Fallback)
═══════════════════════════════════════

Tópico Solicitado:
${prompt}

───────────────────────────────────────

Este documento foi gerado em modo fallback porque o serviço de IA 
estava temporariamente indisponível.

Por favor, tente novamente mais tarde para obter conteúdo 
gerado por inteligência artificial.

───────────────────────────────────────
Data: ${new Date().toLocaleString('pt-PT')}
Gerado por: CalsaBOT`;
}

// Alias para compatibilidade
const generatePDF = createPDF;

module.exports = { 
  createPDF,
  generatePDF  // Manter alias para CLI existente
};
