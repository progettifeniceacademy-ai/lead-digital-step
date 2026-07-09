/**
 * Corso "+10h di formazione gratuita" → filtra ≥20% → ActiveCampaign → Foglio
 * ---------------------------------------------------------------------------
 * COME FUNZIONA
 *  1. Tu esporti da Circle la lista studenti del corso (CSV) e trascini il file
 *     nella cartella Google Drive "Export Corso 10h" (la crea la funzione setup).
 *  2. Ogni giorno lo script prende l'export PIÙ RECENTE in quella cartella,
 *     tiene solo chi ha Progressi ≥ 20, cerca l'email su ActiveCampaign per
 *     recuperare telefono/nome/cognome, e scrive nel foglio:
 *        Data_Check | Nome | Cognome | Email | Telefono | Progresso
 *  3. Non crea doppioni: salta chi è già nel foglio (controllo per email).
 *
 * FUNZIONI:
 *  - setup()                      → crea la cartella e prepara il foglio (una volta)
 *  - elaboraExport()              → elabora l'export più recente (lo chiama il trigger)
 *  - installaTriggerGiornaliero() → accende l'automatismo quotidiano
 * ---------------------------------------------------------------------------
 */

// ===== CONFIGURAZIONE (già compilata) =====
var AC_API_URL   = 'https://feniceacademy0089903.api-us1.com';
var AC_API_KEY   = '72ca1b215ab41d91b1f3b41682bef0f70817aeb4eac51d9e269a1484a01325ed22d2af20';
var SHEET_ID     = '16ND-uRlv9o5JHjNLYFw_93AnczfeSt6Tt6qehrv4b1s';
var SHEET_NAME   = 'Risultati';
var FOLDER_NAME  = 'Export Corso 10h';   // cartella Drive dove trascini gli export
var SOGLIA       = 20;                    // includi chi ha Progressi >= 20
var INTESTAZIONE = ['Data_Check', 'Nome', 'Cognome', 'Email', 'Telefono', 'Progresso'];

// ===== SETUP: crea cartella e prepara il foglio (esegui una volta) =====
function setup() {
  var folder = _getCartella();
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sheet = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(INTESTAZIONE);
    sheet.getRange(1, 1, 1, INTESTAZIONE.length).setFontWeight('bold');
  }
  Logger.log('Tutto pronto ✅');
  Logger.log('Trascina qui gli export di Circle: ' + folder.getUrl());
}

// ===== FUNZIONE PRINCIPALE (la chiama il trigger) =====
function elaboraExport() {
  var file = _exportPiuRecente();
  if (!file) { Logger.log('Nessun file CSV nella cartella "' + FOLDER_NAME + '".'); return; }

  var righe = Utilities.parseCsv(file.getBlob().getDataAsString('UTF-8'));
  if (righe.length < 2) { Logger.log('Il file è vuoto.'); return; }

  // trova le colonne dall'intestazione
  var header = righe[0].map(function (h) { return String(h).toLowerCase().trim(); });
  var iMail = _colonna(header, ['e-mail', 'email', 'mail']);
  var iProg = _colonna(header, ['progressi', 'progress', 'progresso']);
  var iNome = _colonna(header, ['nome', 'name']);
  if (iMail < 0 || iProg < 0) {
    Logger.log('Colonne non trovate. Intestazioni lette: ' + righe[0].join(', '));
    return;
  }

  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sheet = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(INTESTAZIONE);
    sheet.getRange(1, 1, 1, INTESTAZIONE.length).setFontWeight('bold');
  }
  var tz = ss.getSpreadsheetTimeZone();
  var oggi = Utilities.formatDate(new Date(), tz, 'dd/MM/yyyy');
  var gia = _emailGiaPresenti(sheet);

  var nuoveRighe = [];
  var aggiunti = 0, sotto = 0, saltati = 0, senzaAc = 0;

  for (var r = 1; r < righe.length; r++) {
    var riga = righe[r];
    if (!riga || riga.length <= iMail) continue;

    var prog = parseFloat(String(riga[iProg] || '').replace(',', '.'));
    if (isNaN(prog) || prog < SOGLIA) { sotto++; continue; }

    var email = String(riga[iMail] || '').toLowerCase().trim();
    if (!email) continue;
    if (gia[email]) { saltati++; continue; }

    var nomeCompleto = iNome >= 0 ? String(riga[iNome] || '').trim() : '';
    var ac = _acTrovaContatto(email);

    var nome, cognome, telefono;
    if (ac) {
      nome = ac.firstName || _split(nomeCompleto).nome;
      cognome = ac.lastName || _split(nomeCompleto).cognome;
      telefono = ac.phone || '';
    } else {
      // non trovato su AC: uso il nome dell'export, telefono vuoto
      senzaAc++;
      nome = _split(nomeCompleto).nome;
      cognome = _split(nomeCompleto).cognome;
      telefono = '';
    }

    nuoveRighe.push([oggi, nome, cognome, email, telefono, prog]);
    gia[email] = true;
    aggiunti++;
  }

  if (nuoveRighe.length) {
    sheet.getRange(sheet.getLastRow() + 1, 1, nuoveRighe.length, INTESTAZIONE.length).setValues(nuoveRighe);
  }

  Logger.log('File elaborato: ' + file.getName());
  Logger.log('Aggiunti: ' + aggiunti + ' | Sotto il ' + SOGLIA + '%: ' + sotto +
             ' | Già presenti: ' + saltati + ' | Aggiunti senza telefono (non su AC): ' + senzaAc);
}

// ===== TRIGGER giornaliero =====
function installaTriggerGiornaliero() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'elaboraExport') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('elaboraExport').timeBased().everyDays(1).atHour(8).create();
  Logger.log('Trigger giornaliero installato (ogni giorno verso le 8).');
}

// ===== UTILITY =====
function _getCartella() {
  var it = DriveApp.getFoldersByName(FOLDER_NAME);
  return it.hasNext() ? it.next() : DriveApp.createFolder(FOLDER_NAME);
}

function _exportPiuRecente() {
  var folder = _getCartella();
  var files = folder.getFiles();
  var recente = null;
  while (files.hasNext()) {
    var f = files.next();
    var nome = f.getName().toLowerCase();
    var mime = f.getBlob().getContentType();
    var pareCsv = nome.indexOf('.csv') >= 0 || mime === 'text/csv' || mime === 'application/vnd.ms-excel';
    if (!pareCsv) continue;
    if (!recente || f.getLastUpdated() > recente.getLastUpdated()) recente = f;
  }
  return recente;
}

function _colonna(header, nomiPossibili) {
  for (var i = 0; i < header.length; i++) {
    for (var j = 0; j < nomiPossibili.length; j++) {
      if (header[i] === nomiPossibili[j]) return i;
    }
  }
  return -1;
}

function _split(nomeCompleto) {
  var parti = String(nomeCompleto || '').trim().split(/\s+/);
  if (parti.length === 0 || parti[0] === '') return { nome: '', cognome: '' };
  if (parti.length === 1) return { nome: parti[0], cognome: '' };
  return { nome: parti[0], cognome: parti.slice(1).join(' ') };
}

function _emailGiaPresenti(sheet) {
  var set = {};
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return set;
  var header = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var col = 4; // default: colonna Email
  for (var i = 0; i < header.length; i++) {
    if (String(header[i]).toLowerCase().trim() === 'email') { col = i + 1; break; }
  }
  var valori = sheet.getRange(2, col, lastRow - 1, 1).getValues();
  valori.forEach(function (v) {
    var e = String(v[0] || '').toLowerCase().trim();
    if (e) set[e] = true;
  });
  return set;
}

function _acTrovaContatto(email) {
  var url = AC_API_URL.replace(/\/+$/, '') + '/api/3/contacts?email=' + encodeURIComponent(email);
  var resp = UrlFetchApp.fetch(url, { method: 'get', muteHttpExceptions: true,
    headers: { 'Api-Token': AC_API_KEY } });
  if (resp.getResponseCode() < 200 || resp.getResponseCode() >= 300) return null;
  var data;
  try { data = JSON.parse(resp.getContentText()); } catch (e) { return null; }
  if (data && data.contacts && data.contacts.length > 0) {
    var c = data.contacts[0];
    return { firstName: c.firstName || '', lastName: c.lastName || '', phone: c.phone || '' };
  }
  return null;
}
