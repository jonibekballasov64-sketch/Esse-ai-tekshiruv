const fs = require('fs');
const path = require('path');

// Railway'da /data volume ulangan bo'lsa shundan foydalanamiz (doimiy saqlash).
// Volume mavjud bo'lmasa (masalan lokal test paytida), konteyner ichidagi data/ papkasiga tushadi.
const DATA_DIR = fs.existsSync('/data') ? '/data' : path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'submissions.json');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function load() {
  ensureDataDir();
  if (!fs.existsSync(DATA_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch (e) {
    console.error('Submissions faylini o\'qishda xato:', e.message);
    return [];
  }
}

let submissions = load();

function save() {
  ensureDataDir();
  fs.writeFileSync(DATA_FILE, JSON.stringify(submissions, null, 2));
}

// Toshkent vaqti (UTC+5) bo'yicha bugungi sana, kunlik limitni to'g'ri hisoblash uchun
function todayStr() {
  const now = new Date();
  const tashkent = new Date(now.getTime() + 5 * 60 * 60 * 1000);
  return tashkent.toISOString().slice(0, 10);
}

function hasSubmittedToday(userId) {
  const today = todayStr();
  return submissions.some((s) => String(s.userId) === String(userId) && s.date === today);
}

function addSubmission(sub) {
  submissions.push(sub);
  save();
}

function updateSubmission(id, updates) {
  const idx = submissions.findIndex((s) => s.id === id);
  if (idx === -1) return null;
  submissions[idx] = { ...submissions[idx], ...updates };
  save();
  return submissions[idx];
}

function getSubmission(id) {
  return submissions.find((s) => s.id === id) || null;
}

function getFailedOrPendingToday() {
  return getTodaysSubmissions().filter((s) => s.status === 'failed' || s.status === 'pending');
}

function getTodaysSubmissions() {
  const today = todayStr();
  return submissions.filter((s) => s.date === today);
}

function getUnfinalizedTodaySubmissions() {
  return getTodaysSubmissions().filter((s) => !s.finalized && s.status === 'evaluated');
}

function markFinalized(ids) {
  const idSet = new Set(ids);
  submissions.forEach((s) => {
    if (idSet.has(s.id)) s.finalized = true;
  });
  save();
}

module.exports = {
  todayStr,
  hasSubmittedToday,
  addSubmission,
  updateSubmission,
  getSubmission,
  getTodaysSubmissions,
  getUnfinalizedTodaySubmissions,
  getFailedOrPendingToday,
  markFinalized,
};
