const { FULL_RUBRIC_TEXT } = require('./criteria');

const MODEL = 'gpt-4o';

const SYSTEM_PROMPT = `Sen O'zbekiston Milliy Sertifikat (Attestatsiya) tizimida ona tili va adabiyot fanidan yoziladigan ESSE (yozma ish)ni rasmiy mezon asosida baholovchi ekspertsan.

Quyida to'liq rasmiy baholash mezoni berilgan. Har bir bandni mezonga QATʼIY rioya qilgan holda, xolisona va aniq bahola. Har xatoni essening o'zidan aniq misol (jumla yoki so'z birikmasi) keltirib ko'rsat — umumiy gapirma.

${FULL_RUBRIC_TEXT}

Javobni FAQAT quyidagi JSON formatida qaytar, boshqa hech qanday matn, izoh yoki markdown belgisi (masalan \`\`\`) qo'shma:

{
  "bands": [
    {"number": 1, "ball": 1.5, "xatolar": ["Aniq xato tavsifi, essedagi jumla/so'z bilan"]},
    ... (1 dan 12 gacha barcha bandlar uchun)
  ],
  "umumiy_izoh": "Esse haqida 1-2 jumlalik qisqa umumiy xulosa"
}

Muhim qoidalar:
- "ball" qiymati faqat quyidagilardan biri bo'lishi mumkin: 2, 1.5, 1, 0.5, 0.
- Agar biror bandda xato bo'lmasa (ball=2), "xatolar" massivini bo'sh qoldir yoki "Xatolik aniqlanmadi" deb yoz.
- Har bir xato alohida qatorda, aniq va tushunarli qilib yozilsin.
- Agar esse mavzuga mos bo'lmasa, 100 so'zdan kam bo'lsa yoki ko'chirma bo'lib tuyulsa — buni "umumiy_izoh"da alohida ta'kidla, lekin baribir bandlarni baholab chiq.`;

async function evaluateEssay(topic, essayText) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY sozlanmagan');

  const userContent = `MAVZU: ${topic}\n\nESSE MATNI:\n${essayText}`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 4000,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userContent },
      ],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`OpenAI API xatosi: ${response.status} ${errText}`);
  }

  const data = await response.json();
  const raw = data.choices?.[0]?.message?.content;
  if (!raw) throw new Error('OpenAI javobida matn topilmadi');

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    throw new Error('OpenAI javobini JSON qilib o\'qib bo\'lmadi: ' + e.message);
  }

  if (!parsed.bands || !Array.isArray(parsed.bands) || parsed.bands.length !== 12) {
    throw new Error('OpenAI javobida 12 ta band topilmadi');
  }

  return parsed;
}

module.exports = { evaluateEssay };
