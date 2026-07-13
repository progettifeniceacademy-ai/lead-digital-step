/**
 * Corso 10h → tag "<20% corso 10h" su Circle → ActiveCampaign → Foglio
 * --------------------------------------------------------------------
 * Legge chi ha il tag Circle "<20% corso 10h" (id 271325), cerca l'email su
 * ActiveCampaign e scrive nel foglio: Data_Check | Nome | Cognome | Email | Telefono.
 * Niente doppioni (salta chi è già nel foglio). Gira ogni giorno in automatico.
 *
 * FUNZIONI:
 *  - testTag()                    → PROVA: dice quante persone hanno il tag (non scrive)
 *  - aggiornaCorsoTag()           → il lavoro vero (lo chiama il trigger)
 *  - installaTriggerGiornaliero() → accende l'automatismo quotidiano
 * --------------------------------------------------------------------
 */

// ===== CONFIGURAZIONE (già compilata) =====
var CIRCLE_API_TOKEN = '1a3NT4DgMRHAoWPsBJSpd9g24rJwHS3v';
var TAG_ID           = 271325;              // tag "<20% corso 10h"
var AC_API_URL       = 'https://feniceacademy0089903.api-us1.com';
var AC_API_KEY       = '72ca1b215ab41d91b1f3b41682bef0f70817aeb4eac51d9e269a1484a01325ed22d2af20';
var SHEET_ID         = '16ND-uRlv9o5JHjNLYFw_93AnczfeSt6Tt6qehrv4b1s';
var SHEET_NAME       = 'Risultati';
var INTESTAZIONE     = ['Data_Check', 'Nome', 'Cognome', 'Email', 'Telefono'];

// ===== PROVA: quante persone hanno il tag (non scrive nulla) =====
function testTag() {
  var emails = _emailConTag();
  Logger.log('Persone con il tag "<20% corso 10h": ' + emails.length);
  Logger.log('Prime 10: ' + emails.slice(0, 10).join(', '));
}

// ===== FUNZIONE PRINCIPALE (la chiama il trigger) =====
function aggiornaCorsoTag() {
  var emails = _emailConTag();

  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sheet = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(INTESTAZIONE);
    sheet.getRange(1, 1, 1, INTESTAZIONE.length).setFontWeight('bold');
  }
  var tz = ss.getSpreadsheetTimeZone();
  var oggi = Utilities.formatDate(new Date(), tz, 'dd/MM/yyyy');
  var gia = _emailGiaPresenti(sheet);

  var nuove = [];
  var aggiunti = 0, saltati = 0, senzaAc = 0;

  emails.forEach(function (email) {
    if (gia[email]) { saltati++; return; }
    var ac = _acTrovaContatto(email);
    var nome = ac ? (ac.firstName || '') : '';
    var cognome = ac ? (ac.lastName || '') : '';
    var telefono = ac ? (ac.phone || '') : '';
    if (!ac) senzaAc++;
    nuove.push([oggi, nome, cognome, email, telefono]);
    gia[email] = true;
    aggiunti++;
  });

  if (nuove.length) {
    sheet.getRange(sheet.getLastRow() + 1, 1, nuove.length, INTESTAZIONE.length).setValues(nuove);
  }
  Logger.log('Fatto. Aggiunti: ' + aggiunti + ' | Già presenti: ' + saltati +
             ' | Aggiunti senza telefono (non su AC): ' + senzaAc);
}

// ===== TRIGGER giornaliero =====
function installaTriggerGiornaliero() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'aggiornaCorsoTag') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('aggiornaCorsoTag').timeBased().everyDays(1).atHour(8).create();
  Logger.log('Trigger giornaliero installato (ogni giorno verso le 8).');
}

// ===== CIRCLE: tutte le email che hanno il tag TAG_ID =====
function _emailConTag() {
  var out = [];
  var visti = {};
  var page = 1;
  while (true) {
    var url = 'https://app.circle.so/api/admin/v2/tagged_members'
            + '?member_tag_ids=' + TAG_ID
            + '&per_page=100&page=' + page;
    var data = _circleGet(url);
    var recs = (data && data.records) ? data.records : [];
    if (recs.length === 0) break;

    recs.forEach(function (r) {
      // filtro di sicurezza: tengo solo il tag giusto
      if (r.member_tag_id !== TAG_ID) return;
      var email = (r.user_email || r.lead_email || '').toLowerCase().trim();
      if (email && !visti[email]) { visti[email] = true; out.push(email); }
    });

    if (data && data.has_next_page) { page++; } else { break; }
    if (page > 400) break; // salvagente
  }
  return out;
}

function _circleGet(url) {
  var resp = UrlFetchApp.fetch(url, { method: 'get', muteHttpExceptions: true,
    headers: { 'Authorization': 'Bearer ' + CIRCLE_API_TOKEN } });
  var body = resp.getContentText();
  var data = null;
  try { data = JSON.parse(body); } catch (e) { data = null; }
  if (!data || (data.status && data.message && !data.records)) {
    Logger.log('Circle errore su ' + url + ' → ' + body.slice(0, 200));
    return null;
  }
  return data;
}

// ===== ACTIVECAMPAIGN =====
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

// ===== UTILITY =====
function _emailGiaPresenti(sheet) {
  var set = {};
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return set;
  var header = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var col = 4; // colonna Email
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
