const ExcelJS = require('exceljs');

async function buildExcelReport(submissions) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Hisobot');

  sheet.columns = [
    { header: '№', key: 'num', width: 5 },
    { header: 'Ism-Familiya', key: 'name', width: 28 },
    { header: 'Username', key: 'username', width: 20 },
    { header: 'Telegram ID', key: 'id', width: 15 },
    { header: 'Mavzu', key: 'topic', width: 35 },
    { header: '24 ballik', key: 'total', width: 10 },
    { header: '75 ballik', key: 'total75', width: 10 },
    { header: 'Topshirilgan vaqt', key: 'time', width: 20 },
  ];

  submissions.forEach((s, i) => {
    sheet.addRow({
      num: i + 1,
      name: s.fullName,
      username: s.username || '-',
      id: s.userId,
      topic: s.topic,
      total: s.total,
      total75: s.total75,
      time: new Date(s.submittedAt).toLocaleString('uz-UZ', { timeZone: 'Asia/Tashkent' }),
    });
  });

  sheet.getRow(1).font = { bold: true };
  sheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFFFE699' },
  };
  sheet.autoFilter = { from: 'A1', to: 'H1' };

  return workbook.xlsx.writeBuffer();
}

module.exports = { buildExcelReport };
