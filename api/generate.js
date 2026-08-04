// api/generate.js
// Один код доступа, хранится в переменной окружения ACCESS_CODE на Vercel.
// Поддерживает как обычный текст, так и фото (мультимодальный запрос).
// Также разрешает ограниченное число бесплатных попыток (trial: true) —
// подсчёт ведётся на стороне браузера (localStorage), поэтому это не
// железная защита, а простая мягкая мера, как и общий код доступа.

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { licenseCode, content, trial } = req.body;

  const hasValidCode = licenseCode && licenseCode === process.env.ACCESS_CODE;

  if (!hasValidCode && !trial) {
    return res.status(403).json({ error: 'Invalid access code' });
  }

  if (!content) {
    return res.status(400).json({ error: 'No content provided' });
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1200,
        messages: [{ role: 'user', content }]
      })
    });

    const data = await response.json();
    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: 'Error contacting AI' });
  }
}
