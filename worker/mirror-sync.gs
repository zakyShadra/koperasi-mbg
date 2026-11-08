// Koperasi MBG, sinkron dua arah Sheet <-> D1. Bound script, terikat ke
// spreadsheet KoperasiMBG. Worker -> Sheet: doPost op upsert (cari baris
// berdasarkan kolom ID, update di tempat, tambah kalau belum ada). Sheet ->
// Worker: trigger onEdit yang terpasang (installable) mengirim baris yang
// berubah ke Worker. Yang paling baru menang berdasarkan diubah_pada.
// Pantulan tidak mungkin jadi loop: baris yang memantul punya diubah_pada
// yang sama dengan yang sudah ada, jadi perbandingan menganggapnya seri
// dan tidak menulis apa-apa. Kunci CacheService hanya penanda tulis mirror,
// bukan penghalang edit user: edit user selalu dikirim, Worker yang
// memutuskan lewat diubah_pada. Dulu lock 120 detik malah menelan edit
// user kedua pada baris yang sama (18:53, 2026-11-08), jadi lock tidak
// lagi dipakai untuk melewati edit.
// Secret: MIRROR_SECRET (Worker -> GAS, di dalam body JSON) dan SYNC_SECRET
// (GAS -> Worker, header X-Sheet-Sync-Secret). Keduanya diset sebagai
// Script properties, jangan pernah ditulis di kode.

var WORKER_URL = 'https://koperasimbg.ices.my.id';
var PROP_SECRET = 'MIRROR_SECRET';
var PROP_SYNC_SECRET = 'SYNC_SECRET';
var LOCK_TTL_SECONDS = 30;

var KEY_COLS = {
  'Anggota': ['id'],
  'Kategori': ['id'],
  'Produk': ['kode_produk'],
  'Pesanan': ['nomor_pesanan'],
  'Pesanan Item': ['nomor_pesanan', 'kode_produk'],
  'Transaksi': ['id_transaksi'],
  'Staf': ['email'],
  'Laporan': ['jenis', 'periode_mulai', 'periode_selesai', 'dibuat_oleh']
};

var SHEET_ID = '1YLyLFdnuJ9P8rVuXAGMceX8C7SUCXesScCdxTu1Mu6k';

function ss_() {
  return SpreadsheetApp.openById(SHEET_ID);
}

function doGet() {
  return json_({ ok: true, service: 'koperasi-mbg-sync' });
}

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var secret = PropertiesService.getScriptProperties().getProperty(PROP_SECRET);
    if (!secret || data.secret !== secret) {
      return json_({ ok: false, error: 'unauthorized' });
    }
    if (data.action === 'dump') return dump_(data.tab);
    var op = data.op || 'append';
    if (op === 'upsert') return upsert_(data);
    if (op === 'delete') return delete_(data);
    return append_(data);
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

function dump_(tab) {
  if (!KEY_COLS[tab]) return json_({ ok: false, error: 'tab tidak dikenal' });
  var sheet = ss_().getSheetByName(tab);
  if (!sheet) return json_({ ok: false, error: 'tab tidak ada' });
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  if (lastRow < 1 || lastCol < 1) return json_({ ok: true, tab: tab, headers: [], rows: [] });
  var values = sheet.getRange(1, 1, lastRow, lastCol).getValues();
  var headers = values[0].map(function (h) { return String(h); });
  var rows = values.slice(1).filter(function (r) {
    return r.some(function (c) { return c !== '' && c !== null; });
  });
  return json_({ ok: true, tab: tab, headers: headers, rows: rows });
}

function delete_(data) {
  var tab = data.tab;
  if (!KEY_COLS[tab]) return json_({ ok: false, error: 'tab tidak dikenal' });
  var sheet = ss_().getSheetByName(tab);
  if (!sheet) return json_({ ok: false, error: 'tab tidak ada' });
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(String);
  var keyCols = data.keyCols || KEY_COLS[tab];
  var key = data.key || '';
  var rowNum = findRow_(sheet, headers, keyCols, key, null);
  if (rowNum <= 0) return json_({ ok: true, tab: tab, deleted: 0 });
  sheet.deleteRow(rowNum);
  return json_({ ok: true, tab: tab, deleted: 1 });
}

function append_(data) {
  var tab = data.tab;
  if (!KEY_COLS[tab]) return json_({ ok: false, error: 'tab tidak dikenal' });
  var sheet = ss_().getSheetByName(tab);
  if (!sheet) return json_({ ok: false, error: 'tab tidak ada' });
  var rows = data.rows || [];
  if (!rows.length) return json_({ ok: true, tab: tab, appended: 0 });
  var width = 0;
  rows.forEach(function (r) { if (r.length > width) width = r.length; });
  rows.forEach(function (r) { while (r.length < width) r.push(''); });
  sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, width).setValues(rows);
  return json_({ ok: true, tab: tab, appended: rows.length });
}

function upsert_(data) {
  var tab = data.tab;
  if (!KEY_COLS[tab]) return json_({ ok: false, error: 'tab tidak dikenal' });
  var sheet = ss_().getSheetByName(tab);
  if (!sheet) return json_({ ok: false, error: 'tab tidak ada' });
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(String);
  var idx = {};
  headers.forEach(function (h, i) { idx[h] = i; });
  var keyCols = data.keyCols || KEY_COLS[tab];
  var tsCol = idx['diubah_pada'];
  var rows = data.rows || [];
  var rowNums = data.rowNums || [];
  var updated = 0;
  var inserted = 0;
  var skipped = [];
  rows.forEach(function (obj, n) {
    var key = keyCols.map(function (c) { return String(obj[c] == null ? '' : obj[c]); }).join('|');
    var rowNum = findRow_(sheet, headers, keyCols, key, rowNums[n]);
    var incomingTs = normTs_(obj['diubah_pada']);
    if (rowNum > 0) {
      if (tsCol !== undefined) {
        var sheetTs = normTs_(sheet.getRange(rowNum, tsCol + 1).getValue());
        if (sheetTs !== '' && incomingTs !== '' && sheetTs > incomingTs) {
          skipped.push({ key: key, sheet_ts: sheetTs });
          return;
        }
      }
      writeRow_(sheet, headers, rowNum, obj);
      setLock_(tab, key, incomingTs);
      updated++;
    } else {
      var values = headers.map(function (h) { return obj[h] == null ? '' : obj[h]; });
      sheet.getRange(sheet.getLastRow() + 1, 1, 1, values.length).setValues([values]);
      setLock_(tab, key, incomingTs);
      inserted++;
    }
  });
  return json_({ ok: true, tab: tab, updated: updated, inserted: inserted, skipped: skipped });
}

function findRow_(sheet, headers, keyCols, key, hint) {
  var lastRow = sheet.getLastRow();
  if (hint && hint >= 2 && hint <= lastRow) {
    var hintVals = sheet.getRange(hint, 1, 1, sheet.getLastColumn()).getValues()[0];
    var hintKey = keyCols.map(function (c) { return String(hintVals[headers.indexOf(c)] == null ? '' : hintVals[headers.indexOf(c)]); }).join('|');
    var hintEmpty = keyCols.every(function (c) { return String(hintVals[headers.indexOf(c)] || '') === ''; });
    if (hintKey === key || hintEmpty) return hint;
  }
  if (lastRow < 2) return 0;
  var keyIdx = keyCols.map(function (c) { return headers.indexOf(c); });
  if (keyIdx.some(function (i) { return i < 0; })) return 0;
  var width = sheet.getLastColumn();
  var values = sheet.getRange(2, 1, lastRow - 1, width).getValues();
  for (var i = 0; i < values.length; i++) {
    var k = keyIdx.map(function (ci) { return String(values[i][ci] == null ? '' : values[i][ci]); }).join('|');
    if (k === key) return i + 2;
  }
  return 0;
}

function writeRow_(sheet, headers, rowNum, obj) {
  var values = headers.map(function (h) { return obj[h] == null ? '' : obj[h]; });
  sheet.getRange(rowNum, 1, 1, values.length).setValues([values]);
}

function onSheetEdit(e) {
  try {
    var range = e.range;
    var sheet = range.getSheet();
    var tab = sheet.getName();
    if (!KEY_COLS[tab]) return;
    if (tab === 'Staf') return;
    Logger.log('onSheetEdit ' + tab + ' baris ' + range.getRow() + '-' + range.getLastRow());
    var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(String);
    var idx = {};
    headers.forEach(function (h, i) { idx[h] = i; });
    if (range.getNumColumns() === 1 && range.getColumn() - 1 === idx['diubah_pada']) return;
    var startRow = Math.max(range.getRow(), 2);
    var endRow = range.getLastRow();
    var lastCol = sheet.getLastColumn();
    var tsCol = idx['diubah_pada'];
    if (tsCol === undefined) return;
    var now = nowWib_();
    var rows = [];
    var rowNums = [];
    for (var r = startRow; r <= endRow; r++) {
      var vals = sheet.getRange(r, 1, 1, lastCol).getValues()[0];
      var obj = {};
      headers.forEach(function (h, i) { obj[h] = vals[i]; });
      var key = KEY_COLS[tab].map(function (c) { return String(obj[c] == null ? '' : obj[c]); }).join('|');
      var empty = Object.keys(obj).every(function (k) { return obj[k] === '' || obj[k] === null; });
      if (empty) continue;
      if (String(obj['sumber'] || '') === 'contoh') continue;
      if (hasLock_(tab, key)) Logger.log('onSheetEdit ' + tab + ' ' + key + ': lock lama ada, tetap kirim.');
      sheet.getRange(r, tsCol + 1).setValue(now);
      obj['diubah_pada'] = now;
      setLock_(tab, key, now);
      rows.push(obj);
      rowNums.push(r);
    }
    if (!rows.length) return;
    var syncSecret = PropertiesService.getScriptProperties().getProperty(PROP_SYNC_SECRET);
    if (!syncSecret) {
      Logger.log('SYNC_SECRET belum diset, perubahan tidak dikirim ke Worker.');
      return;
    }
    var res = null;
    for (var attempt = 0; attempt < 2 && !res; attempt++) {
      try {
        res = UrlFetchApp.fetch(WORKER_URL + '/api/sheet-sync', {
          method: 'post',
          contentType: 'application/json',
          headers: { 'X-Sheet-Sync-Secret': syncSecret },
          payload: JSON.stringify({ tab: tab, rows: rows, rowNums: rowNums }),
          muteHttpExceptions: true
        });
      } catch (err) {
        Logger.log('sheet-sync ' + tab + ' percobaan ' + (attempt + 1) + ' gagal: ' + String(err));
        Utilities.sleep(1000);
      }
    }
    if (!res) {
      Logger.log('sheet-sync ' + tab + ': POST gagal 2x, ' + rows.length + ' baris tidak terkirim.');
      return;
    }
    Logger.log('sheet-sync ' + tab + ': ' + res.getResponseCode() + ' ' + res.getContentText().slice(0, 300));
  } catch (err) {
    Logger.log('onSheetEdit error: ' + String(err));
  }
}

function setSyncSecrets_(mirrorSecret, syncSecret) {
  var props = PropertiesService.getScriptProperties();
  props.setProperty(PROP_SECRET, mirrorSecret);
  props.setProperty(PROP_SYNC_SECRET, syncSecret);
  return { mirror_set: !!props.getProperty(PROP_SECRET), sync_set: !!props.getProperty(PROP_SYNC_SECRET) };
}

function setupSync() {
  var triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(function (t) {
    if (t.getHandlerFunction() === 'onSheetEdit') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('onSheetEdit').forSpreadsheet(ss_()).onEdit().create();
  var props = PropertiesService.getScriptProperties();
  Logger.log('Trigger onSheetEdit terpasang. MIRROR_SECRET terisi: ' + !!props.getProperty(PROP_SECRET) + ', SYNC_SECRET terisi: ' + !!props.getProperty(PROP_SYNC_SECRET));
}

function lockKey_(tab, key) {
  return 'sync:' + tab + ':' + encodeURIComponent(key);
}

function setLock_(tab, key, ts) {
  try {
    CacheService.getScriptCache().put(lockKey_(tab, key), ts || '1', LOCK_TTL_SECONDS);
  } catch (err) {
    // Cache gagal tidak boleh menggagalkan tulis.
  }
}

function hasLock_(tab, key) {
  try {
    return CacheService.getScriptCache().get(lockKey_(tab, key)) !== null;
  } catch (err) {
    return false;
  }
}

function nowWib_() {
  return Utilities.formatDate(new Date(), 'Asia/Jakarta', 'yyyy-MM-dd HH:mm:ss');
}

function normTs_(v) {
  if (v === null || v === undefined || v === '') return '';
  if (Object.prototype.toString.call(v) === '[object Date]') {
    return Utilities.formatDate(v, 'Asia/Jakarta', 'yyyy-MM-dd HH:mm:ss');
  }
  var m = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/.exec(String(v).trim());
  if (!m) return '';
  function p(x) { return String(x === undefined ? '00' : x).padStart(2, '0'); }
  return m[1] + '-' + p(m[2]) + '-' + p(m[3]) + ' ' + p(m[4]) + ':' + p(m[5]) + ':' + p(m[6]);
}

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
