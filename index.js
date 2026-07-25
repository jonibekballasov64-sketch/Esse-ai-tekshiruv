const crypto = require('crypto');
const { Telegraf, Markup } = require('telegraf');
const { evaluateEssay } = require('./claude');
const { formatEvaluation, escapeHtml, splitLongText } = require('./format');
const store = require('./store');
const { buildExcelReport } = require('./report');

const BOT_TOKEN = process.env.BOT_TOKEN;
const GROUP_ID = process.env.GROUP_ID;
const ADMIN_ID = process.env.ADMIN_ID;

if (!BOT_TOKEN || !GROUP_ID || !ADMIN_ID) {
  console.error('BOT_TOKEN, GROUP_ID va ADMIN_ID Railway Variables bo\'limida sozlanishi shart!');
  process.exit(1);
}

const bot = new Telegraf(BOT_TOKEN);

// Bot FAQAT shaxsiy (private) chatda ishlaydi — guruhda yozilgan xabarlarga umuman javob bermaydi
bot.use((ctx, next) => {
  if (ctx.chat && ctx.chat.type !== 'private') {
    return;
  }
  return next();
});

// Foydalanuvchi holati: userId -> { state: 'awaiting_topic'|'awaiting_essay', topic }
const sessions = new Map();

function isAdmin(ctx) {
  return String(ctx.from.id) === String(ADMIN_ID);
}

async function isGroupMember(ctx) {
  try {
    const member = await ctx.telegram.getChatMember(GROUP_ID, ctx.from.id);
    return ['creator', 'administrator', 'member'].includes(member.status);
  } catch (e) {
    console.error('Guruh a\'zoligini tekshirishda xato:', e.message);
    return false;
  }
}

function getUserLabel(from) {
  const username = from.username ? `@${from.username}` : null;
  const fullName = [from.first_name, from.last_name].filter(Boolean).join(' ');
  return username ? `${fullName} (${username})` : fullName || `ID:${from.id}`;
}

function wordCount(text) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

// Ism-familiyaga o'xshagan matnni aniqlash (masalan "Aliyev Vali") — mavzu sifatida qabul qilinmasin
function looksLikeName(text) {
  const trimmed = text.trim();
  const words = trimmed.split(/\s+/);
  if (words.length < 1 || words.length > 3) return false;
  // Har bir so'z bosh harf bilan boshlanishi, raqam/tinish belgisi bo'lmasligi kerak (ism-familiya uslubi)
  const namePattern = /^[A-ZА-ЯЎҚҒҲЁ][a-zа-яўқғҳёʻ']*$/;
  return words.every((w) => namePattern.test(w));
}

// Mavzu — qisqa, bitta xabar, ko'p xatboshili bo'lmasligi kerak (esse bilan adashtirmaslik uchun)
function looksLikeTopic(text) {
  const wc = wordCount(text);
  const paragraphs = text.split(/\n\s*\n/).filter((p) => p.trim().length > 0).length;
  if (looksLikeName(text)) return false;
  return wc >= 3 && wc <= 40 && paragraphs <= 1;
}

// Esse — rasmiy mezonga ko'ra kamida 100 so'zdan iborat bo'lishi shart
function looksLikeEssay(text) {
  return wordCount(text) >= 100;
}

bot.start(async (ctx) => {
  const member = await isGroupMember(ctx);
  if (!member) {
    return ctx.reply(
      "❌ Kechirasiz, siz guruh a'zosi emassiz.\n\nXizmatdan foydalanish uchun avval tegishli guruhga a'zo bo'ling."
    );
  }

  if (store.hasSubmittedToday(ctx.from.id)) {
    return ctx.reply(
      "✅ Siz esse yubordingiz, qabul qilindi.\n\n📊 Natijasini kuting — Nargiza Olimovna barcha esselarni yakunlagach e'lon qilinadi."
    );
  }

  sessions.set(ctx.from.id, { state: 'awaiting_topic' });
  return ctx.reply(
    "✅ Xush kelibsiz!\n\n📌 Esse mavzusini kiriting (qisqa, bitta xabar qilib yuboring):"
  );
});

bot.command('bekor', (ctx) => {
  sessions.delete(ctx.from.id);
  ctx.reply("Bekor qilindi. Qaytadan boshlash uchun /start bosing.");
});

// ============ ADMIN: Qabulni yakunlash ============

bot.command('yakunlash', async (ctx) => {
  if (!isAdmin(ctx)) return;
  const pending = store.getUnfinalizedTodaySubmissions();
  if (pending.length === 0) {
    return ctx.reply('Bugun hali hech kim esse topshirmagan, yoki hammasi allaqachon yakunlangan.');
  }
  return ctx.reply(
    `Bugun ${pending.length} ta esse muvaffaqiyatli baholangan.\n\nBarchasining natijasini talabgorlarga yuborib, umumiy hisobotni tayyorlaymi?`,
    Markup.inlineKeyboard([
      [Markup.button.callback('✅ Ha, yakunlash', 'finalize_confirm')],
      [Markup.button.callback('❌ Bekor qilish', 'finalize_cancel')],
    ])
  );
});

bot.action('finalize_cancel', async (ctx) => {
  await ctx.answerCbQuery();
  if (!isAdmin(ctx)) return;
  await ctx.editMessageText('Bekor qilindi.');
});

bot.action('finalize_confirm', async (ctx) => {
  await ctx.answerCbQuery();
  if (!isAdmin(ctx)) return;

  const pending = store.getUnfinalizedTodaySubmissions();
  if (pending.length === 0) {
    return ctx.editMessageText('Yuborish uchun natija topilmadi.');
  }

  await ctx.editMessageText(`⏳ ${pending.length} ta natija talabgorlarga yuborilmoqda...`);

  let sentCount = 0;
  for (const sub of pending) {
    try {
      const personalHeader =
        `Assalomu alaykum, <b>${escapeHtml(sub.fullName)}</b>!\n` +
        `📌 Mavzu: ${escapeHtml(sub.topic)}\n\n` +
        `Essangizning tahlili va natijasi quyida:\n\n`;
      const fullMessage = personalHeader + sub.resultText;
      for (const chunk of splitLongText(fullMessage)) {
        await bot.telegram.sendMessage(sub.userId, chunk, { parse_mode: 'HTML' });
      }
      sentCount++;
    } catch (e) {
      console.error(`Foydalanuvchi ${sub.userId} ga yuborishda xato:`, e.message);
    }
  }

  try {
    const buffer = await buildExcelReport(pending);
    store.markFinalized(pending.map((s) => s.id));
    await bot.telegram.sendDocument(
      ADMIN_ID,
      { source: buffer, filename: `hisobot-${store.todayStr()}.xlsx` },
      { caption: `📊 ${pending.length} ta esse bo'yicha hisobot` }
    );
    await ctx.reply(`✅ Yakunlandi. ${sentCount}/${pending.length} ta natija yuborildi va hisobot fayli tayyor.`);
  } catch (e) {
    console.error('Hisobot yaratishda xato:', e.message);
    await ctx.reply(`⚠️ Natijalar yuborildi (${sentCount}/${pending.length}), lekin hisobot faylini yaratishda xato: ${e.message}`);
  }
});

// ============ ADMIN: xato/kutilayotgan esselarni ko'rish va qayta urinish ============

bot.action(/^retry_(.+)$/, async (ctx) => {
  await ctx.answerCbQuery();
  if (!isAdmin(ctx)) return;
  const submissionId = ctx.match[1];
  const sub = store.getSubmission(submissionId);
  if (!sub) {
    return ctx.reply('Bu esse topilmadi (ehtimol allaqachon o\'chirilgan).');
  }
  if (sub.status === 'evaluated') {
    return ctx.reply('Bu esse allaqachon muvaffaqiyatli baholangan.');
  }
  await ctx.reply('⏳ Qayta urinilmoqda...');
  const userLabel = sub.username ? `${sub.fullName} (${sub.username})` : sub.fullName;
  await runEvaluation(sub.id, sub.topic, sub.essayText, userLabel);
});

bot.command('xatolar', async (ctx) => {
  if (!isAdmin(ctx)) return;
  const stuck = store.getFailedOrPendingToday();
  if (stuck.length === 0) {
    return ctx.reply('✅ Bugun xato/kutilayotgan esse yo\'q — hammasi baholangan.');
  }
  for (const sub of stuck) {
    const label = sub.username ? `${sub.fullName} (${sub.username})` : sub.fullName;
    const statusLabel = sub.status === 'pending' ? '⏳ Kutilmoqda' : `❌ Xato: ${escapeHtml(sub.errorMessage || 'noma\'lum')}`;
    await ctx.reply(
      `👤 ${escapeHtml(label)} (ID: ${sub.userId})\n📌 ${escapeHtml(sub.topic)}\n${statusLabel}`,
      {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([[Markup.button.callback('🔄 Qayta urinib ko\'rish', `retry_${sub.id}`)]]),
      }
    );
  }
});

// ============ ASOSIY OQIM ============

bot.on('text', async (ctx) => {
  const text = ctx.message.text;
  if (text.startsWith('/')) return;

  const userId = ctx.from.id;
  const session = sessions.get(userId);

  if (!session) {
    return ctx.reply("Boshlash uchun /start bosing.");
  }

  const member = await isGroupMember(ctx);
  if (!member) {
    sessions.delete(userId);
    return ctx.reply("❌ Siz hozir guruh a'zosi emassiz. Xizmatdan foydalana olmaysiz.");
  }

  if (session.state === 'awaiting_topic') {
    if (!looksLikeTopic(text)) {
      return ctx.reply(
        "⚠️ Bu mavzu ko'rinishida emas (ism-familiyaga, juda qisqa yoki juda uzun matnga o'xshaydi).\n\nIltimos, FAQAT esse mavzusini to'liq va aniq, bitta xabar qilib yuboring (masalan: \"Zamonaviy texnologiyalarning ta'lim jarayoniga ta'siri\")."
      );
    }
    session.topic = text;
    session.state = 'awaiting_essay';
    return ctx.reply(
      `📌 Mavzu qabul qilindi:\n"${text}"\n\n📝 Endi shu mavzuda yozilgan essening to'liq matnini yuboring (kamida 100 so'z):`
    );
  }

  if (session.state === 'awaiting_essay') {
    if (!looksLikeEssay(text)) {
      return ctx.reply(
        "⚠️ Bu esse uchun juda qisqa ko'rinadi (esse kamida 100 so'zdan iborat bo'lishi kerak).\n\nIltimos, to'liq esse matnini yuboring."
      );
    }

    if (store.hasSubmittedToday(userId)) {
      sessions.delete(userId);
      return ctx.reply("✅ Siz esse yubordingiz, qabul qilindi. Natijasini kuting.");
    }

    const essayText = text;
    const topic = session.topic;
    sessions.delete(userId); // Bugungi limit tugadi — o'zgartirish/qayta yuborish qabul qilinmaydi

    const userLabel = getUserLabel(ctx.from);
    const fullName = [ctx.from.first_name, ctx.from.last_name].filter(Boolean).join(' ') || 'Nomsiz';

    // Esse DARHOL saqlanadi (baholashdan oldin) — shu tufayli hech qanday holatda yo'qolmaydi
    const submission = {
      id: crypto.randomUUID(),
      userId,
      fullName,
      username: ctx.from.username ? `@${ctx.from.username}` : null,
      topic,
      essayText,
      status: 'pending', // pending -> evaluated | failed
      resultText: null,
      total: null,
      total75: null,
      errorMessage: null,
      date: store.todayStr(),
      submittedAt: new Date().toISOString(),
      finalized: false,
    };
    store.addSubmission(submission);

    await ctx.reply(
      "✅ Essangiz qabul qilindi.\n\n⚠️ Diqqat: bundan keyin o'zgartirish yoki tuzatish kiritib bo'lmaydi.\n\n📊 Natijangiz Nargiza Olimovna barcha esselarni yakunlagach e'lon qilinadi."
    );

    await runEvaluation(submission.id, topic, essayText, userLabel);
  }
});

async function runEvaluation(submissionId, topic, essayText, userLabel) {
  const sub = store.getSubmission(submissionId);
  if (!sub) return;

  try {
    const evaluation = await evaluateEssay(topic, essayText);
    const { text: resultText, total, total75 } = formatEvaluation(evaluation);

    store.updateSubmission(submissionId, {
      status: 'evaluated',
      resultText,
      total,
      total75,
      errorMessage: null,
    });

    const header =
      `🆕 <b>Yangi esse baholandi</b>\n` +
      `👤 <b>Foydalanuvchi:</b> ${escapeHtml(userLabel)} (ID: ${sub.userId})\n` +
      `📌 <b>Mavzu:</b> ${escapeHtml(topic)}\n` +
      `📊 <b>Natija:</b> ${total} / 24 → <b>${total75} / 75</b>`;
    await bot.telegram.sendMessage(ADMIN_ID, header, { parse_mode: 'HTML' });

    const essayMsg = `📝 <b>Esse matni</b> (${escapeHtml(userLabel)}):\n\n${escapeHtml(essayText)}`;
    for (const chunk of splitLongText(essayMsg)) {
      await bot.telegram.sendMessage(ADMIN_ID, chunk, { parse_mode: 'HTML' });
    }
    for (const chunk of splitLongText(resultText)) {
      await bot.telegram.sendMessage(ADMIN_ID, chunk, { parse_mode: 'HTML' });
    }
  } catch (err) {
    console.error('Baholashda xato:', err);
    store.updateSubmission(submissionId, {
      status: 'failed',
      errorMessage: err.message,
    });
    await bot.telegram
      .sendMessage(
        ADMIN_ID,
        `⚠️ <b>Esse baholanmadi</b> — foydalanuvchi: ${escapeHtml(userLabel)} (ID: ${sub.userId})\n📌 Mavzu: ${escapeHtml(topic)}\n\nXato: ${escapeHtml(err.message)}\n\nEsse matni saqlangan, yo'qolmagan — qayta urinish uchun tugmani bosing.`,
        {
          parse_mode: 'HTML',
          ...Markup.inlineKeyboard([[Markup.button.callback('🔄 Qayta urinib ko\'rish', `retry_${submissionId}`)]]),
        }
      )
      .catch(() => {});
  }
}

bot.catch((err, ctx) => {
  console.error('Bot xatosi:', err);
});

bot.launch().then(() => {
  console.log('Bot ishga tushdi.');
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
