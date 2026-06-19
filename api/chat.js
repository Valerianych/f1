const crypto = require('node:crypto');
let token = globalThis.__gigaChatToken ?? null;

async function readJson(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

async function getAccessToken() {
  if (token && token.expiresAt > Date.now()) return token.value;
  if (!process.env.GIGACHAT_AUTH_KEY) return null;

  const response = await fetch('https://ngw.devices.sberbank.ru:9443/api/v2/oauth', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${process.env.GIGACHAT_AUTH_KEY}`,
      RqUID: crypto.randomUUID(),
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({ scope: process.env.GIGACHAT_SCOPE ?? 'GIGACHAT_API_PERS' })
  });

  if (!response.ok) throw new Error(`GigaChat OAuth ${response.status}: ${await response.text()}`);
  const data = await response.json();
  token = { value: data.access_token, expiresAt: Date.now() + 29 * 60 * 1000 };
  globalThis.__gigaChatToken = token;
  return token.value;
}

function sendJson(response, statusCode, data) {
  response.statusCode = statusCode;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.end(JSON.stringify(data));
}

module.exports = async function handler(request, response) {
  if (request.method !== 'POST') return sendJson(response, 405, { error: 'Method not allowed' });

  try {
    const body = await readJson(request);
    const accessToken = await getAccessToken();
    if (!accessToken) {
      return sendJson(response, 200, { answer: 'ИИ-чат временно недоступен. Проверьте ключ GigaChat.' });
    }

    const systemPrompt = 'Ты — помощник по Формуле-1 внутри сайта аналитики гонок. Отвечай простым русским языком. Не выдумывай данные. Если данных нет в переданном контексте, честно скажи. Если пользователь спрашивает, кто виноват или кто накосячил, формулируй аккуратно: возможный проблемный момент, Race Control отметил, по данным видно.';
    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Контекст гонки: ${JSON.stringify(body.context ?? {}).slice(0, 8000)}` },
      ...(body.messages ?? [])
    ];

    const completion = await fetch('https://gigachat.devices.sberbank.ru/api/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: process.env.GIGACHAT_MODEL ?? 'GigaChat', messages })
    });

    if (!completion.ok) throw new Error(`GigaChat chat ${completion.status}: ${await completion.text()}`);
    const data = await completion.json();
    return sendJson(response, 200, { answer: data.choices?.[0]?.message?.content ?? 'Не удалось получить ответ GigaChat.' });
  } catch (error) {
    return sendJson(response, 502, { answer: 'ИИ-чат временно недоступен. Проверьте ключ GigaChat.', error: String(error) });
  }
};
