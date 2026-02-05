/**
 * AI Agent - Integração com Groq API (LLM rápido)
 * 
 * Nota: A key gsk_* é da Groq (groq.com), não da Grok (xAI)
 * Endpoint: https://api.groq.com/openai/v1/chat/completions
 */

require('dotenv').config();

// Suporta ambos os nomes: GROQ_API_KEY (correto) ou GROK_API_KEY (legacy)
const GROQ_API_KEY = process.env.GROQ_API_KEY || process.env.GROK_API_KEY;
const GROQ_MODEL = 'llama-3.3-70b-versatile'; // Modelo recomendado Groq

if (!GROQ_API_KEY) {
  console.warn('⚠️ Groq offline (GROQ_API_KEY não encontrada no .env)');
}

async function askAI(prompt, options = {}) {
  if (!GROQ_API_KEY) {
    throw new Error('Groq não configurado - adiciona GROQ_API_KEY ao .env');
  }

  const maxTokens = options.maxTokens || 1024;
  const temperature = options.temperature || 0.5; // Reduzido para respostas mais consistentes
  const systemPrompt = options.system || 'És o CalsaBOT, um assistente pessoal inteligente. Responde de forma clara, concisa e útil em português. Evita repetir informação.';

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt }
        ],
        max_tokens: maxTokens,
        temperature: temperature,
        top_p: 0.9,
        frequency_penalty: 0.5 // Penaliza repetições
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Groq API Error: ${response.status} - ${errText}`);
    }

    const data = await response.json();

    // Estrutura OpenAI-compatible
    if (data.choices && data.choices[0] && data.choices[0].message) {
      return data.choices[0].message.content;
    }

    throw new Error('Resposta inesperada da API Groq');

  } catch (err) {
    console.error('❌ Erro ao chamar Groq:', err.message);
    
    // Fallback informativo
    return `⚠️ AI temporariamente indisponível. Erro: ${err.message}`;
  }
}

// Função para gerar conteúdo específico (PDFs, documentos)
async function generateContent(topic, type = 'documento') {
  const systemPrompt = `És um assistente especializado em criar conteúdo. 
Gera conteúdo bem estruturado em português de Portugal.
Usa formatação clara com títulos, subtítulos e parágrafos.`;

  const prompt = `Cria um ${type} completo e detalhado sobre: ${topic}`;
  
  return await askAI(prompt, { system: systemPrompt, maxTokens: 2048 });
}

module.exports = { 
  askAI,
  generateContent,
  GROQ_MODEL
};
