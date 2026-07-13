/**
 * Corso 10h → tag "<20% corso 10h" su Circle → Foglio
 * ---------------------------------------------------------------------------
 * Legge chi ha il tag Circle "<20% corso 10h" (id 271325) e scrive nel foglio:
 *   Data_Check | Nome | Cognome | Email | Telefono
 * Nome/Cognome/Telefono vengono presi DA CIRCLE (campo profilo "Numero di
 * telefono"). Se su Circle il telefono manca, prova come riserva ActiveCampaign.
 * Niente doppioni (salta chi è già nel foglio). Gira ogni giorno in automatico.
 *
 * FUNZIONI:
 *  - testTag()                    → PROVA: quante persone hanno il tag + un esempio (non scrive)
 *  - aggiornaCorsoTag()           → il lavoro vero (lo chiama il trigger)
 *  - installaTriggerGiornaliero() → accende l'automatismo quotidiano
 * ---------------------------------------------------------------------------
 */

// ===== CONFIGURAZIONE (già compilata) =====
var CIRCLE_API_TOKEN = '1a3NT4DgMRHAoWPsBJSpd9g24rJwHS3v';
var TAG_ID           = 271325;              // tag "<20% corso 10h"
var AC_API_URL       = 'https://feniceacademy0089903.api-us1.com';
var AC_API_KEY       = '72ca1b215ab41d91b1f3b41682bef0f70817aeb4eac51d9e269a1484a01325ed22d2af20';
var SHEET_ID         = '16ND-uRlv9o5JHjNLYFw_93AnczfeSt6Tt6qehrv4b1s';
var SHEET_NAME       = 'Risultati';
var INTESTAZIONE     = ['Data_Check', 'Nome', 'Cognome', 'Email', 'Telefono'];

// ===== PROVA (non scrive nulla) =====
function testTag() {
  var membri = _membriConTag();
  Logger.log('Persone con il tag "<20% corso 10h": ' + membri.length);
  if (membri.length) {
    var d = _dettagliMembro(membri[0].id, membri[0].email);
    Logger.log('Esempio → ' + membri[0].email + ' | Nome: ' + d.firstName +
               ' | Cognome: ' + d.lastName + ' | Telefono: ' + d.phone + ' | fonte: ' + d.fonte);
  }
}

// ===== FUNZIONE PRINCIPALE (la chiama il trigger) =====
function aggiornaCorsoTag() {
  var membri = _membriConTag();

  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sheet = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(INTESTAZIONE);
    sheet.getRange(1, 1, 1, INTESTAZIONE.length).setFontWeight('bold');
  }
  var tz = ss.getSpreadsheetTimeZone();
  var oggi = Utilities.formatDate(new Date(), tz, 'dd/MM/yyyy');
  var gia = _emailGiaPresenti(sheet);

  // mappa email -> id (serve per riempire dopo i telefoni mancanti)
  var mappaId = {};
  membri.forEach(function (m) { mappaId[m.email] = m.id; });

  var nuove = [], aggiunti = 0, saltati = 0, senzaTel = 0;

  membri.forEach(function (m) {
    if (gia[m.email]) { saltati++; return; }
    var d = _dettagliMembro(m.id, m.email);
    if (!d.phone) senzaTel++;
    nuove.push([oggi, d.firstName, d.lastName, m.email, d.phone]);
    gia[m.email] = true;
    aggiunti++;
  });

  if (nuove.length) {
    sheet.getRange(sheet.getLastRow() + 1, 1, nuove.length, INTESTAZIONE.length).setValues(nuove);
  }

  // ripassa le righe già esistenti col telefono vuoto e prova a riempirle
  var riempiti = _riempiMancanti(sheet, mappaId);

  Logger.log('Fatto. Aggiunti: ' + aggiunti + ' | Già presenti: ' + saltati +
             ' | Nuovi senza telefono: ' + senzaTel + ' | Telefoni recuperati nelle righe vecchie: ' + riempiti);
}

// Ripassa le righe con Telefono vuoto e prova a riempire telefono/nome/cognome
function _riempiMancanti(sheet, mappaId) {
  var last = sheet.getLastRow();
  if (last < 2) return 0;
  var vals = sheet.getRange(2, 1, last - 1, INTESTAZIONE.length).getValues();
  var riempiti = 0;
  for (var i = 0; i < vals.length; i++) {
    var nome = vals[i][1], cognome = vals[i][2];
    var email = String(vals[i][3] || '').toLowerCase().trim();
    var tel = String(vals[i][4] || '').trim();
    if (!email) continue;
    if (_telefonoValido(tel)) continue; // ha già un telefono valido, salto

    var d = _dettagliMembro(mappaId[email] || null, email);
    var row = i + 2;
    if (!nome && d.firstName) sheet.getRange(row, 2).setValue(d.firstName);
    if (!cognome && d.lastName) sheet.getRange(row, 3).setValue(d.lastName);
    if (d.phone) { sheet.getRange(row, 5).setValue(d.phone); riempiti++; }
  }
  return riempiti;
}

// ===== TRIGGER giornaliero =====
function installaTriggerGiornaliero() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'aggiornaCorsoTag') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('aggiornaCorsoTag').timeBased().everyDays(1).atHour(8).create();
  Logger.log('Trigger giornaliero installato (ogni giorno verso le 8).');
}

// ===== CIRCLE: membri (id + email) che hanno il tag =====
function _membriConTag() {
  var out = [], visti = {}, page = 1;
  while (true) {
    var url = 'https://app.circle.so/api/admin/v2/tagged_members'
            + '?member_tag_ids=' + TAG_ID + '&per_page=100&page=' + page;
    var data = _circleGet(url);
    var recs = (data && data.records) ? data.records : [];
    if (recs.length === 0) break;
    recs.forEach(function (r) {
      if (r.member_tag_id !== TAG_ID) return;
      var email = (r.user_email || r.lead_email || '').toLowerCase().trim();
      if (email && !visti[email]) {
        visti[email] = true;
        out.push({ id: r.community_member_id || r.contact_id, email: email });
      }
    });
    if (data && data.has_next_page) { page++; } else { break; }
    if (page > 400) break;
  }
  return out;
}

// ===== Dettagli membro: nome/cognome/telefono (prima Circle, poi AC) =====
function _dettagliMembro(id, email) {
  var m = null;

  // 1) Circle per id
  if (id) {
    var d1 = _circleGet('https://app.circle.so/api/admin/v2/community_members/' + id);
    if (d1) m = d1.community_member || (d1.records && d1.records[0]) || d1;
  }
  // 2) Circle per email (riserva)
  if (!m || !(m.flattened_profile_fields || m.first_name)) {
    var d2 = _circleGet('https://app.circle.so/api/admin/v2/community_members/search?email=' + encodeURIComponent(email));
    if (d2) m = d2.community_member || (d2.records && d2.records[0]) || d2;
  }

  var firstName = '', lastName = '', phone = '', fonte = '';
  if (m) {
    firstName = m.first_name || '';
    lastName = m.last_name || '';
    var ff = m.flattened_profile_fields || {};
    var tel = ff.numero_di_telefono || ff.telefono || ff.phone || '';
    if (_telefonoValido(tel)) { phone = tel; fonte = 'Circle'; }
  }

  // 3) riserva ActiveCampaign per il telefono (e nome se manca)
  if (!phone) {
    var ac = _acTrovaContatto(email);
    if (ac) {
      if (_telefonoValido(ac.phone)) { phone = ac.phone; fonte = 'ActiveCampaign'; }
      if (!firstName) firstName = ac.firstName || '';
      if (!lastName) lastName = ac.lastName || '';
    }
  }
  if (!fonte) fonte = '(nessuna)';
  return { firstName: firstName, lastName: lastName, phone: phone, fonte: fonte };
}

// Considera "non valido" (= vuoto) un numero finto: troppo corto o tutte cifre uguali (es. 00000000)
function _telefonoValido(p) {
  var d = String(p || '').replace(/\D/g, '');
  if (d.length < 7) return false;
  if (/^(\d)\1+$/.test(d)) return false;
  return true;
}

function _circleGet(url) {
  var resp = UrlFetchApp.fetch(url, { method: 'get', muteHttpExceptions: true,
    headers: { 'Authorization': 'Bearer ' + CIRCLE_API_TOKEN } });
  var body = resp.getContentText();
  var data = null;
  try { data = JSON.parse(body); } catch (e) { data = null; }
  if (!data || (data.status && data.message && !data.records && !data.id)) return null;
  return data;
}

// ===== ACTIVECAMPAIGN (riserva) =====
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
  var set = {}, lastRow = sheet.getLastRow();
  if (lastRow < 2) return set;
  var header = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var col = 4;
  for (var i = 0; i < header.length; i++) {
    if (String(header[i]).toLowerCase().trim() === 'email') { col = i + 1; break; }
  }
  sheet.getRange(2, col, lastRow - 1, 1).getValues().forEach(function (v) {
    var e = String(v[0] || '').toLowerCase().trim();
    if (e) set[e] = true;
  });
  return set;
}
