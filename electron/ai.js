/**
 * AI-полировка из main-процесса (десктоп): Gemini / OpenAI / Ollama.
 * Чистый fetch без зависимостей. При ошибке вызывающий код падает на локальный форматер.
 */

function buildPrompt(text, mode, language) {
  const langName = language === 'en' ? 'English' : 'Russian';
  const modeHint = {
    clean: 'Standard clean text with proper punctuation and grammar.',
    email: 'Professional email with greeting and sign-off.',
    bullets: 'Concise bullet-point list of key points.',
    chat: 'Friendly casual chat message.',
    code: 'Clean technical note; wrap tech terms in backticks.',
  }[mode] || 'Standard clean text.';

  return `You are Flow, a voice-dictation formatter (like Wispr Flow).
Rules:
1. Remove filler words ("эм", "ну", "как бы", "um", "uh", "like", "you know").
2. Fix punctuation, capitalization and grammar.
3. Style: ${modeHint}
4. Output language: ${langName}.
5. Return ONLY the formatted text, no explanations, no markdown fences.

Transcript: """${text}"""`;
}

const strip = (s) => (s ? s.replace(/^```[a-z]*\n?/i, '').replace(/```$/, '').trim() : null);

async function withTimeout(promiseFn, ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await promiseFn(controller.signal);
  } finally {
    clearTimeout(timer);
  }
}

export async function aiFormat(text, mode, language, provider, key) {
  const prompt = buildPrompt(text, mode, language);

  if (provider === 'openai') {
    const data = await withTimeout(
      (signal) =>
        fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          signal,
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            temperature: 0.2,
            messages: [{ role: 'user', content: prompt }],
          }),
        }).then((r) => r.json()),
      25000
    );
    return strip(data?.choices?.[0]?.message?.content);
  }

  if (provider === 'ollama') {
    const base = (process.env.OLLAMA_URL || 'http://localhost:11434').replace(/\/$/, '');
    const model = process.env.OLLAMA_MODEL || 'llama3.1';
    const data = await withTimeout(
      (signal) =>
        fetch(`${base}/api/chat`, {
          method: 'POST',
          signal,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model,
            stream: false,
            options: { temperature: 0.2 },
            messages: [
              { role: 'system', content: 'You are Flow, a voice dictation formatter. Output only the formatted text.' },
              { role: 'user', content: prompt },
            ],
          }),
        }).then((r) => r.json()),
      30000
    );
    return strip(data?.message?.content);
  }

  // Gemini
  for (const model of ['gemini-1.5-flash', 'gemini-2.0-flash']) {
    try {
      const data = await withTimeout(
        (signal) =>
          fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
            {
              method: 'POST',
              signal,
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
            }
          ).then((r) => r.json()),
        25000
      );
      const out = strip(data?.candidates?.[0]?.content?.parts?.[0]?.text);
      if (out) return out;
    } catch {
      /* следующая модель */
    }
  }
  return null;
}
