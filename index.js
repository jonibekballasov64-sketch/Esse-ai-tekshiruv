const { Telegraf } = require('telegraf');
const { evaluateEssay } = require('./claude');
const { formatEvaluation, escapeHtml, splitLongText } = require('./format');

const BOT_TOKEN = process.env.BOT_TOKEN;
const GROUP_ID = process.env.GROUP_ID; // masalan: -1001234567890 yoki @guruh_username
const ADMIN_ID = process.env.ADMIN_ID; // sizning shaxsiy Telegram ID'ingiz

if (!BOT_TOKEN || !GROUP_ID || !ADMIN_ID) {
  console.error('BOT_TOKEN, GROUP_ID va ADMIN_ID Railway Variables bo\'limida sozlanishi shart!');
  process.exit(1);
}

const bot = new Telegraf(BOT_TOKEN);

// Foydalanuvchi holati: userId -> { state: 'awaiting_topic'|'awaiting_essay', topic }
const sessions = new Map();

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

bot.start(async (ctx) => {
  const member = await isGroupMember(ctx);
  if (!member) {
    return ctx.reply(
      "❌ Kechirasiz, siz guruh a'zosi emassiz.\n\nXizmatdan foydalanish uchun avval tegishli guruhga a'zo bo'ling."
    );
  }
  sessions.set(ctx.from.id, { state: 'awaiting_topic' });
  return ctx.reply(
    "✅ Xush kelibsiz!\n\n📌 Esse mavzusini kiriting (matn qilib yuboring):"
  );
});

bot.command('bekor', (ctx) => {
  sessions.delete(ctx.from.id);
  ctx.reply("Bekor qilindi. Qaytadan boshlash uchun /start bosing.");
});

bot.on('text', async (ctx) => {
  const text = ctx.message.text;
  if (text.startsWith('/')) return; // buyruqlar alohida ishlanadi

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
    session.topic = text;
    session.state = 'awaiting_essay';
    return ctx.reply(
      `📌 Mavzu qabul qilindi:\n"${text}"\n\n📝 Endi shu mavzuda yozilgan essening to'liq matnini yuboring:`
    );
  }

  if (session.state === 'awaiting_essay') {
    const essayText = text;
    const topic = session.topic;
    sessions.set(userId, { state: 'awaiting_topic' }); // keyingi esse uchun darhol tayyor

    const waitMsg = await ctx.reply('⏳ Tekshirilmoqda... Iltimos, kuting.');

    try {
      const evaluation = await evaluateEssay(topic, essayText);
      const { text: resultText, total, total75 } = formatEvaluation(evaluation);

      await ctx.telegram.deleteMessage(ctx.chat.id, waitMsg.message_id).catch(() => {});

      for (const chunk of splitLongText(resultText)) {
        await ctx.reply(chunk, { parse_mode: 'HTML' });
      }

      await ctx.reply(
        "Yangi esse yuborish uchun mavzuni kiriting, yoki /start bosing."
      );

      // Adminga (va sizga) xabar yuborish
      const userLabel = getUserLabel(ctx.from);
      const header =
        `👤 <b>Foydalanuvchi:</b> ${escapeHtml(userLabel)} (ID: ${userId})\n` +
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
      await ctx.telegram
        .editMessageText(ctx.chat.id, waitMsg.message_id, undefined, '❌ Tekshirishda xatolik yuz berdi. Iltimos, /start bosib qayta urinib ko\'ring.')
        .catch(() => ctx.reply('❌ Tekshirishda xatolik yuz berdi. Iltimos, /start bosib qayta urinib ko\'ring.'));
      await bot.telegram
        .sendMessage(ADMIN_ID, `⚠️ Xatolik (foydalanuvchi ${userId}): ${err.message}`)
        .catch(() => {});
    }
  }
});

bot.catch((err, ctx) => {
  console.error('Bot xatosi:', err);
});

bot.launch().then(() => {
  console.log('Bot ishga tushdi.');
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
