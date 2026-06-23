/**
 * Digital Step → ActiveCampaign → Foglio Google
 * ------------------------------------------------------------
 * Ogni giorno controlla chi è entrato nello spazio "Digital Step" su Circle,
 * cerca la stessa email su ActiveCampaign e, se la trova, aggiunge una riga
 * al foglio con: CheckGiorno | Nome | Cognome | Telefono.
 *
 * Logica anti-buco e anti-duplicati:
 *  - WATERMARK: salva la data dell'ultimo membro processato. Ad ogni run
 *    processa TUTTO ciò che è entrato dopo il segnalibro. Se un giorno il
 *    trigger salta, il giorno dopo recupera comunque gli arretrati.
 *  - SEEN_IDS: tiene l'elenco degli ID già inseriti, così non scrive mai
 *    due volte la stessa persona (nemmeno al confine della finestra).
 *
 * Funzioni che ti interessano (menu a tendina in alto in Apps Script):
 *  - installaTriggerGiornaliero()  → installa il trigger automatico (una volta)
 *  - aggiornaDigitalStep()         → il lavoro vero (lo chiama il trigger)
 *  - test_DryRun()                 → SIMULA senza scrivere nulla: per verificare
 *  - backfill(giorni)              → recupera gli arretrati degli ultimi N giorni
 *  - testConnessione()             → verifica che le chiavi API funzionino
 * ------------------------------------------------------------
 */

// =============================================================
//  CONFIGURAZIONE
//  Imposta i valori in: Apps Script → Impostazioni progetto →
//  "Proprietà script" (Script Properties). NON scrivere le chiavi qui.
// =============================================================
function _config() {
  var p = PropertiesService.getScriptProperties();
  return {
    CIRCLE_API_TOKEN: p.getProperty('CIRCLE_API_TOKEN'),     // token Admin API v1 di Circle
    CIRCLE_SPACE_ID:  p.getProperty('CIRCLE_SPACE_ID') || '2482783', // Digital Step
    AC_API_URL:       p.getProperty('AC_API_URL'),           // es: https://tuoaccount.api-us1.com
    AC_API_KEY:       p.getProperty('AC_API_KEY'),           // Api-Token di ActiveCampaign
    SHEET_ID:         p.getProperty('SHEET_ID'),             // ID del foglio Google
    SHEET_NAME:       p.getProperty('SHEET_NAME') || 'Foglio1'
  };
}

// Lookback usato alla PRIMA esecuzione (quando non c'è ancora un segnalibro).
// 7 giorni così la prima volta recupera anche Federico ed Emanuela.
var PRIMO_LOOKBACK_GIORNI = 7;

// =============================================================
//  TRIGGER
// =============================================================
function installaTriggerGiornaliero() {
  // Rimuove eventuali trigger doppi dello stesso script
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'aggiornaDigitalStep') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('aggiornaDigitalStep')
    .timeBased()
    .everyDays(1)
    .atHour(7) // gira ogni giorno verso le 7 del mattino (orario del progetto)
    .create();
  Logger.log('Trigger giornaliero installato. Controlla: Apple/Trigger nella barra a sinistra.');
}

// =============================================================
//  FUNZIONE PRINCIPALE (la chiama il trigger ogni giorno)
// =============================================================
function aggiornaDigitalStep() {
  var cfg = _config();
  _assertConfig(cfg);

  var props = PropertiesService.getScriptProperties();
  var watermark = props.getProperty('WATERMARK');
  var since;
  if (watermark) {
    since = new Date(watermark);
  } else {
    // Prima esecuzione: parti da N giorni fa
    since = new Date(Date.now() - PRIMO_LOOKBACK_GIORNI * 24 * 60 * 60 * 1000);
  }

  var risultato = _processa(cfg, since, false); // false = scrivi davvero
  Logger.log('Fatto. Nuove righe aggiunte: ' + risultato.aggiunti +
             ' | Saltati (già presenti): ' + risultato.giaVisti +
             ' | Senza match su ActiveCampaign: ' + risultato.senzaMatch.join(', '));
}

// =============================================================
//  BACKFILL: recupera gli arretrati degli ultimi N giorni
//  Eseguila UNA VOLTA per recuperare chi è stato perso (es. backfill(7))
// =============================================================
function backfill(giorni) {
  giorni = giorni || 7;
  var cfg = _config();
  _assertConfig(cfg);
  var since = new Date(Date.now() - giorni * 24 * 60 * 60 * 1000);
  var risultato = _processa(cfg, since, false);
  Logger.log('Backfill ' + giorni + ' giorni → aggiunti: ' + risultato.aggiunti +
             ' | già presenti: ' + risultato.giaVisti +
             ' | senza match: ' + risultato.senzaMatch.join(', '));
}

// =============================================================
//  TEST A VUOTO (dry run): NON scrive nulla, mostra solo cosa farebbe
//  Usala per verificare che tutto funzioni prima di fidarti dell'automatismo
// =============================================================
function test_DryRun() {
  var cfg = _config();
  _assertConfig(cfg);
  var since = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000); // ultimi 3 giorni
  var risultato = _processa(cfg, since, true); // true = DRY RUN, non scrive
  Logger.log('--- DRY RUN (nessuna scrittura) ---');
  Logger.log('Righe che verrebbero aggiunte: ' + risultato.aggiunti);
  Logger.log('Anteprima:\n' + risultato.anteprima.join('\n'));
  Logger.log('Senza match su ActiveCampaign: ' + risultato.senzaMatch.join(', '));
}

// =============================================================
//  CUORE DEL PROCESSO
// =============================================================
function _processa(cfg, since, dryRun) {
  var props = PropertiesService.getScriptProperties();
  var seen = JSON.parse(props.getProperty('SEEN_IDS') || '[]');
  var seenSet = {};
  seen.forEach(function (id) { seenSet[id] = true; });

  // 1) Prendi i membri dello spazio Digital Step entrati da "since" in poi
  var membri = _circleMembriNuovi(cfg, since, seenSet);
  // ordine cronologico crescente, così il foglio resta in ordine
  membri.sort(function (a, b) { return new Date(a.created_at) - new Date(b.created_at); });

  var ss, sheet, tz;
  if (!dryRun) {
    ss = SpreadsheetApp.openById(cfg.SHEET_ID);
    sheet = ss.getSheetByName(cfg.SHEET_NAME) || ss.insertSheet(cfg.SHEET_NAME);
    _assicuraIntestazione(sheet);
    tz = ss.getSpreadsheetTimeZone();
  } else {
    tz = Session.getScriptTimeZone();
  }

  var oggi = Utilities.formatDate(new Date(), tz, 'dd/MM/yyyy');
  var risultato = { aggiunti: 0, giaVisti: 0, senzaMatch: [], anteprima: [] };
  var maxTs = since.getTime();
  var nuoviSeen = [];

  membri.forEach(function (m) {
    var ts = new Date(m.created_at).getTime();
    if (ts > maxTs) maxTs = ts;

    if (seenSet[m.id]) { risultato.giaVisti++; return; }

    var email = m.email;
    if (!email) { risultato.senzaMatch.push('(membro senza email id ' + m.id + ')'); return; }

    var ac = _acTrovaContatto(cfg, email);
    if (!ac) { risultato.senzaMatch.push(email); return; }

    // Colonne richieste: CheckGiorno | Nome | Cognome | Telefono
    var nome = ac.firstName || m.first_name || '';
    var cognome = ac.lastName || m.last_name || '';
    var telefono = ac.phone || '';
    var riga = [oggi, nome, cognome, telefono];

    if (dryRun) {
      risultato.anteprima.push(riga.join(' | ') + '   <' + email + '>');
    } else {
      sheet.appendRow(riga);
    }
    risultato.aggiunti++;
    nuoviSeen.push(m.id);
  });

  // 2) Aggiorna stato (solo se NON è un dry run)
  if (!dryRun) {
    var tuttiSeen = seen.concat(nuoviSeen);
    // tieni solo gli ultimi 3000 ID per non far crescere all'infinito la proprietà
    if (tuttiSeen.length > 3000) tuttiSeen = tuttiSeen.slice(tuttiSeen.length - 3000);
    props.setProperty('SEEN_IDS', JSON.stringify(tuttiSeen));
    props.setProperty('WATERMARK', new Date(maxTs).toISOString());
  }

  return risultato;
}

// =============================================================
//  CIRCLE: membri dello spazio entrati dopo "since" e non ancora visti
// =============================================================
function _circleMembriNuovi(cfg, since, seenSet) {
  var out = [];
  var page = 1;
  var perPage = 100;
  var sinceMs = since.getTime();

  while (true) {
    var url = 'https://app.circle.so/api/v1/space_members'
            + '?space_id=' + encodeURIComponent(cfg.CIRCLE_SPACE_ID)
            + '&per_page=' + perPage
            + '&page=' + page;
    var res = _fetchJson(url, {
      method: 'get',
      headers: { 'Authorization': 'Token ' + cfg.CIRCLE_API_TOKEN }
    });

    var records = (res && res.records) ? res.records : [];
    for (var i = 0; i < records.length; i++) {
      var r = records[i];
      var cm = r.community_member || {};
      var createdAt = r.created_at; // data di ingresso NELLO SPAZIO
      if (!createdAt) continue;
      if (new Date(createdAt).getTime() < sinceMs) continue; // troppo vecchio
      out.push({
        id: r.id,
        created_at: createdAt,
        email: cm.email || null,
        first_name: cm.first_name || '',
        last_name: cm.last_name || ''
      });
    }

    if (res && res.has_next_page) { page++; } else { break; }
    if (page > 100) break; // salvagente
  }
  return out;
}

// =============================================================
//  ACTIVECAMPAIGN: cerca un contatto per email esatta
// =============================================================
function _acTrovaContatto(cfg, email) {
  var url = cfg.AC_API_URL.replace(/\/+$/, '')
          + '/api/3/contacts?email=' + encodeURIComponent(email);
  var res = _fetchJson(url, {
    method: 'get',
    headers: { 'Api-Token': cfg.AC_API_KEY }
  });
  if (res && res.contacts && res.contacts.length > 0) {
    return res.contacts[0];
  }
  return null;
}

// =============================================================
//  UTILITY
// =============================================================
function _fetchJson(url, options) {
  options = options || {};
  options.muteHttpExceptions = true;
  var tentativi = 0;
  while (true) {
    tentativi++;
    var resp = UrlFetchApp.fetch(url, options);
    var code = resp.getResponseCode();
    if (code >= 200 && code < 300) {
      try { return JSON.parse(resp.getContentText()); }
      catch (e) { return null; }
    }
    // 429/5xx → riprova con backoff fino a 4 volte
    if ((code === 429 || code >= 500) && tentativi < 4) {
      Utilities.sleep(Math.pow(2, tentativi) * 1000);
      continue;
    }
    Logger.log('HTTP ' + code + ' su ' + url + '\n' + resp.getContentText().slice(0, 500));
    return null;
  }
}

function _assicuraIntestazione(sheet) {
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['CheckGiorno', 'Nome', 'Cognome', 'Telefono']);
    sheet.getRange(1, 1, 1, 4).setFontWeight('bold');
  }
}

function _assertConfig(cfg) {
  var mancanti = [];
  ['CIRCLE_API_TOKEN', 'AC_API_URL', 'AC_API_KEY', 'SHEET_ID'].forEach(function (k) {
    if (!cfg[k]) mancanti.push(k);
  });
  if (mancanti.length) {
    throw new Error('Proprietà script mancanti: ' + mancanti.join(', ') +
      '. Vai in Impostazioni progetto → Proprietà script e inseriscile.');
  }
}

// =============================================================
//  TEST CONNESSIONE: verifica che le chiavi API rispondano
// =============================================================
function testConnessione() {
  var cfg = _config();
  _assertConfig(cfg);

  // Circle
  var c = _fetchJson(
    'https://app.circle.so/api/v1/space_members?space_id=' + cfg.CIRCLE_SPACE_ID + '&per_page=1',
    { method: 'get', headers: { 'Authorization': 'Token ' + cfg.CIRCLE_API_TOKEN } });
  Logger.log('Circle OK? membri totali nello spazio: ' + (c && c.count != null ? c.count : 'ERRORE'));

  // ActiveCampaign
  var a = _fetchJson(cfg.AC_API_URL.replace(/\/+$/, '') + '/api/3/contacts?limit=1',
    { method: 'get', headers: { 'Api-Token': cfg.AC_API_KEY } });
  Logger.log('ActiveCampaign OK? contatti totali: ' + (a && a.meta ? a.meta.total : 'ERRORE'));

  // Foglio
  var ss = SpreadsheetApp.openById(cfg.SHEET_ID);
  Logger.log('Foglio OK? nome file: ' + ss.getName() + ' | scheda: ' + cfg.SHEET_NAME);
}
