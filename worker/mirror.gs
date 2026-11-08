// Koperasi MBG mirror writer. Append-only: rows are only added at the end,
// never edited or deleted by this script. Auth: the JSON body must carry
// field "secret" matching script property MIRROR_SECRET. Apps Script doPost
// cannot read request headers, so the X-Mirror-Secret header cannot be
// checked here; the Worker must send the secret in the body.
var PROP_SECRET = 'MIRROR_SECRET';
var SECRET_FIELD = 'secret';

var ALLOWED_TABS = [
  'Anggota',
  'Kategori',
  'Produk',
  'Pesanan',
  'Pesanan Item',
  'Transaksi',
  'Staf',
  'Laporan'
];

function doGet() {
  return json_({ ok: true, service: 'koperasi-mbg-mirror' });
}

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var secret = PropertiesService.getScriptProperties().getProperty(PROP_SECRET);
    if (!secret || data[SECRET_FIELD] !== secret) {
      return json_({ ok: false, error: 'unauthorized' });
    }
    var tab = data.tab;
    if (ALLOWED_TABS.indexOf(tab) < 0) {
      return json_({ ok: false, error: 'tab tidak dikenal' });
    }
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(tab);
    if (!sheet) {
      return json_({ ok: false, error: 'tab tidak ada' });
    }
    var rows = data.rows || [];
    if (!rows.length) {
      return json_({ ok: true, tab: tab, appended: 0 });
    }
    var width = 0;
    rows.forEach(function (r) { if (r.length > width) width = r.length; });
    rows.forEach(function (r) { while (r.length < width) r.push(''); });
    sheet
      .getRange(sheet.getLastRow() + 1, 1, rows.length, width)
      .setValues(rows);
    return json_({ ok: true, tab: tab, appended: rows.length });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
