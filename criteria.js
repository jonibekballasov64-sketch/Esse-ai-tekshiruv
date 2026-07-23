// 12 band mezoni — "Ona tili va adabiyot fanidan yozma ish (esse)ni baholash mezoni" asosida
// Har band 2 / 1.5 / 1 / 0.5 / 0 ball bilan baholanadi. Jami: 24 ball.

const BAND_TITLES = {
  1: "Esse publitsistik uslubda yozilganligiga ko'ra",
  2: "Vaziyat yuzasidan har ikkala qarash hamda shaxsiy qarash yoritilganligiga ko'ra",
  3: "Har ikkala qarashning dalillar bilan asoslanganligiga ko'ra",
  4: "Kirish, asosiy qism va xulosaning to'liq yoritilganligiga ko'ra",
  5: "Mantiqiy qurilish (matn qismlari/gap qurilishi) va xatboshilarga ajratilganligiga ko'ra",
  6: "Mantiqiy-mazmuniy izchillik va fikrlar takrorlanmaganligiga ko'ra",
  7: "Imlo xatolariga ko'ra",
  8: "Punktuatsion xatolarga ko'ra",
  9: "Qo'shimcha qo'llash bilan bog'liq xatolarga ko'ra",
  10: "So'z qo'llash bilan bog'liq uslubiy xatolarga ko'ra",
  11: "Leksik xilma-xillik (lug'at boyligi)ga ko'ra",
  12: "Sheva so'z/qo'shimcha, vulgarizm, varvarizm, parazit so'zlar ishlatilmaganligiga ko'ra",
};

// Rasmiy mezon jadvalining to'liq matni — Claude'ga tizim ko'rsatmasi sifatida beriladi
const FULL_RUBRIC_TEXT = `
UMUMTA'LIM FANLARINI BAHOLASHNING MILLIY TEST TIZIMI — ONA TILI VA ADABIYOT FANIDAN ESSE (YOZMA ISH)NI BAHOLASH MEZONI
Har band 2 ball / 1,5 ball / 1 ball / 0,5 ball / 0 ball asosida baholanadi. Jami: 24 ball.

TOPSHIRIQ TALABLARINING BAJARILGANLIGI
1-band — Uslub:
2: Esse to'liq publitsistik uslubda yozilgan.
1.5: Ayrim o'rinlarda publitsistik uslubdan chekinilgan.
1: Esse qisman publitsistik uslubda yozilgan.
0.5: Esse to'liq badiiy uslubida yozilgan.
0: Esse to'liq so'zlashuv uslubida yozilgan.

2-band — Qarashlar yoritilishi:
2: Har ikkala qarash hamda talabgorning shaxsiy qarashi to'la yoritilgan.
1.5: Har ikkala qarash yoritilgan, shaxsiy fikr yoritilmagan.
1: Qarashlardan bittasi to'la yoritilgan.
0.5: Qarashlardan faqat bittasi qisman yoritilgan.
0: Qarashlar yoritilmagan.

3-band — Dalillanganlik:
2: Har ikkala qarash dalillar bilan asoslangan.
1.5: Faqat bitta qarash dalillangan.
1: Har ikkala qarash uchun keltirilgan ayrim dalillar vaziyatga mos emas.
0.5: Har ikkala qarash uchun keltirilgan dalillar vaziyatga mos emas.
0: Har ikkala qarash dalillanmagan.

MATN YAXLITLIGI (NUTQ KOMPOZITSIYASI, MANTIQIYLIGI)
4-band — Qismlarning to'liqligi:
2: Kirish, asosiy qism va xulosa to'la yoritib berilgan.
1.5: Esse qismlaridan faqat ikkitasi to'la yoritilgan.
1: Esse qismlaridan ikkitasi yuza yoritilgan.
0.5: Esse qismlaridan faqat bittasi to'la yoritilgan.
0: Esse qismlaridan faqat bittasi yuza yoritilgan.

5-band — Mantiqiy qurilish va xatboshi:
2: Xatolik kuzatilmagan, xatboshilarga to'g'ri ajratilgan.
1.5: 1-2 o'rinda xatolik.
1: 3-4 o'rinda xatolik.
0.5: 5-6 o'rinda xatolik.
0: 7 va undan ko'p o'rinda xatolik, yoki umuman xatboshiga ajratilmagan.

6-band — Mantiqiy-mazmuniy izchillik (fikrlar takrori):
2: Takror kuzatilmagan.
1.5: 1-2 o'rinda takror, izchillik buzilmagan.
1: 3-4 o'rinda takror, izchillik buzilgan.
0.5: 5-6 o'rinda takror, izchillik buzilgan.
0: 7 va undan ortiq o'rinda takror, izchillik buzilgan.

SAVODXONLIK (NUTQNING TO'G'RILIGI)
7-band — Imlo xatolari:
2: umuman yo'q. 1.5: 1-2 o'rinda. 1: 3-4 o'rinda. 0.5: 5-6 o'rinda. 0: 7 va undan ortiq.

8-band — Punktuatsion xatolar:
2: umuman yo'q. 1.5: 1-2 o'rinda. 1: 3-4 o'rinda. 0.5: 5-6 o'rinda. 0: 7 va undan ortiq.

TIL BIRLIKLARI USLUBIYATI (NUTQNING JO'YALILIGI)
9-band — Qo'shimcha qo'llash xatolari:
2: umuman yo'q. 1.5: 1-2 o'rinda. 1: 3-4 o'rinda. 0.5: 5-6 o'rinda. 0: 7 va undan ortiq.

10-band — So'z qo'llash bilan bog'liq uslubiy xatolar (noto'g'ri qo'llash, noo'rin takror, ortiqcha qo'llash, tushirib qoldirish, bog'lovchi/kiritma xatosi):
2: umuman yo'q. 1.5: 1-2 o'rinda. 1: 3-4 o'rinda. 0.5: 5-6 o'rinda. 0: 7 va undan ortiq.

LUG'AT BOYLIGI (NUTQNING BOYLIGI, IFODALILIGI VA SOFLIGI)
11-band — Leksik xilma-xillik:
2: Tasviriy ifodalar, maxsus leksik birliklar unumli qo'llangan.
1.5: Bunday birliklardan ayrim o'rinlarda foydalanilgan.
1: Foydalanilgan, lekin ayrim o'rinlarda noo'rin qo'llangan.
0.5: Kuzatilmagan, noo'rin qo'llangan.
0: Umuman foydalanilmagan.

12-band — Sheva so'z/qo'shimcha, vulgarizm, varvarizm, parazit so'zlar:
2: umuman uchramaydi.
1.5: 1-2 o'rinda uchragan, uslubiy g'alizlik yo'q.
1: 3-4 o'rinda uchragan, uslubiy g'alizlik bor.
0.5: 5-6 o'rinda uchragan, uslubiy g'alizlik bor.
0: 7 va undan ko'p o'rinda uchragan, uslubiy g'alizlik bor.

MAXSUS HOLATLAR:
- Esse mavzuga mos bo'lmasa, yoki hajmi 100 so'zdan kam bo'lsa, yoki boshqa manbadan ko'chirilgan bo'lsa — 2 ball beriladi (tekshirilmaydi).
- Esse umuman yozilmagan bo'lsa — 0 ball.
`;

// Umumiy ball (24 ballik) -> 75 ballik shkala. 0.5 qadam bilan, rasmiy jadval asosida.
function convertTo75(totalBall) {
  if (totalBall <= 0) return 0;
  const rounded = Math.round(totalBall * 2) / 2; // 0.5 ga yaxlitlash
  const capped = Math.min(rounded, 24);
  return Math.round((27 + capped * 2) * 10) / 10;
}

module.exports = { BAND_TITLES, FULL_RUBRIC_TEXT, convertTo75 };
