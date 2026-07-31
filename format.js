const { BAND_TITLES, convertTo75 } = require('./criteria');

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function formatBall(n) {
  return Number.isInteger(n) ? String(n) : String(n);
}

// Xato matnini "[tavsif] — to'g'risi: [tuzatish]" shaklidan ajratib,
// tavsifni QALIN, tuzatishni QIYA qilib chiqaradi — o'qish uchun aniqroq bo'lsin
function formatXatoLine(rawText) {
  const escaped = escapeHtml(rawText);
  const match = escaped.match(/^(.*?)[\s]*[—–-][\s]*(to['’‘]g['’‘]risi\s*:.*)$/i);
  if (match) {
    const errorPart = match[1].trim();
    const correctionPart = match[2].trim();
    return `<b>${errorPart}</b> — <i>${correctionPart}</i>`;
  }
  return `<b>${escaped}</b>`;
}

function formatEvaluation(evaluation) {
  let out = '';
  let total = 0;

  for (const band of evaluation.bands) {
    const title = BAND_TITLES[band.number] || `${band.number}-band`;
    total += band.ball;
    out += `‼️ <b>${band.number}-band.</b> ${escapeHtml(title)}\n`;
    out += `✅️ Ball: ${formatBall(band.ball)} ball\n`;
    out += `⚠️ Tahlil:\n`;
    const xatolar = band.xatolar && band.xatolar.length > 0 ? band.xatolar : ['Xatolik aniqlanmadi'];
    for (const x of xatolar) {
      out += `— ${formatXatoLine(x)}\n`;
    }
    out += `\n`;
  }

  const total75 = convertTo75(total);

  out += `📊 <b>Yakuniy natija:</b>\n`;
  out += `24 ballik tizimda: <b>${formatBall(Math.round(total * 10) / 10)} / 24</b>\n`;
  out += `75 ballik tizimda: <b>${total75} ball</b>\n`;

  if (evaluation.ogohlantirishlar && evaluation.ogohlantirishlar.length > 0) {
    out += `\n🔔 <b>Ogohlantirish (ball kesilmagan, faqat eslatma):</b>\n`;
    for (const o of evaluation.ogohlantirishlar) {
      out += `— ${escapeHtml(o)}\n`;
    }
  }

  if (evaluation.umumiy_izoh) {
    out += `\n💬 ${escapeHtml(evaluation.umumiy_izoh)}`;
  }

  return { text: out, total, total75 };
}

function splitLongText(text, maxLen = 3800) {
  const chunks = [];
  let remaining = text;
  while (remaining.length > maxLen) {
    let cutAt = remaining.lastIndexOf('\n', maxLen);
    if (cutAt <= 0) cutAt = maxLen;
    chunks.push(remaining.slice(0, cutAt));
    remaining = remaining.slice(cutAt);
  }
  if (remaining.length > 0) chunks.push(remaining);
  return chunks;
}

module.exports = { escapeHtml, formatEvaluation, splitLongText };
