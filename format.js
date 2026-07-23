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
      out += `— ${escapeHtml(x)}\n`;
    }
    out += `\n`;
  }

  const total75 = convertTo75(total);

  out += `📊 <b>Yakuniy natija:</b>\n`;
  out += `24 ballik tizimda: <b>${formatBall(Math.round(total * 10) / 10)} / 24</b>\n`;
  out += `75 ballik tizimda: <b>${total75} ball</b>\n`;

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
