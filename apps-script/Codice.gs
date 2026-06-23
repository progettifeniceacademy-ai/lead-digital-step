/**
 * Digital Step → ActiveCampaign → Foglio Google
 * ------------------------------------------------------------
 * Ogni giorno controlla chi è entrato nello spazio "Digital Step" su Circle,
 * cerca la stessa email su ActiveCampaign e, se la trova, aggiunge una riga
 * al foglio "Risultati" con: Data_Check | Nome | Cognome | Email | Telefono.
 *
 * Come evita i problemi di prima:
 *  - FINESTRA INTELLIGENTE: non guarda solo "ultime 24 ore". Calcola quanto
 *    tempo è passato dall'ultima esecuzione e guarda indietro abbastanza da
 *    non perdere nessuno, anche se un giorno il trigger non parte. C'è sempre
 *    un margine di sicurezza di qualche giorno.
 *  - NIENTE DOPPIONI: prima di scrivere controlla le email già presenti nel
 *    foglio. Se una persona c'è già, la salta.
 *
 * Funzioni che ti interessano (le selezioni in alto e premi "Esegui"):
 *  - testConnessione()             → verifica che le chiavi API funzionino
 *  - test_DryRun()                 → SIMULA senza scrivere nulla: per controllare
 *  - backfill(giorni)              → recupera gli arretrati degli ultimi N giorni
 *  - installaTriggerGiornaliero()  → accende l'automatismo quotidiano
 *  - aggiornaDigitalStep()         → il lavoro vero (lo chiama il trigger)
 * ------------------------------------------------------------
 */

// =============================================================
//  CONFIGURAZIONE (letta dalle "Proprietà script")
// =============================================================
function _config() {
  var p = PropertiesService.getScriptProperties();
  return {
    CIRCLE_API_TOKEN: p.getProperty('CIRCLE_API_TOKEN'),
    CIRCLE_SPACE_ID:  p.getProperty('CIRCLE_SPACE_ID') || '2482783',
    AC_API_URL:       p.getProperty('AC_API_URL'),
    AC_API_KEY:       p.getProperty('AC_API_KEY'),
    SHEET_ID:         p.getProperty('SHEET_ID'),
    SHEET_NAME:       p.getProperty('SHEET_NAME') || 'Risultati'
  };
}

var GIORNO_MS = 24 * 60 * 60 * 1000;
var LOOKBACK_MINIMO_GIORNI = 3;   // margine di sicurezza ad ogni run
var PRIMO_LOOKBACK_GIORNI  = 7;   // quanto guardare indietro alla prima esecuzione

// Intestazione del foglio (stesso ordine dei tuoi dati esistenti)
var INTESTAZIONE = ['Data_Check', 'Nome', 'Cognome', 'Email', 'Telefono'];

// =============================================================
//  TRIGGER giornaliero
// =============================================================
function installaTriggerGiornaliero() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'aggiornaDigitalStep') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('aggiornaDigitalStep')
    .timeBased()
    .everyDays(1)
    .atHour(7) // ogni giorno verso le 7 (ora di Roma, come da impostazioni progetto)
    .create();
  Logger.log('Trigger giornaliero installato (ogni giorno verso le 7).');
}

// =============================================================
//  FUNZIONE PRINCIPALE (la chiama il trigger ogni giorno)
// =============================================================
function aggiornaDigitalStep() {
  var cfg = _config();
  _assertConfig(cfg);

  var props = PropertiesService.getScriptProperties();
  var ultimoRun = props.getProperty('LAST_RUN');

  var lookbackMs;
  if (ultimoRun) {
    // tempo trascorso dall'ultimo run + 1 giorno di margine, minimo 3 giorni
    lookbackMs = (Date.now() - new Date(ultimoRun).getTime()) + GIORNO_MS;
    if (lookbackMs < LOOKBACK_MINIMO_GIORNI * GIORNO_MS) lookbackMs = LOOKBACK_MINIMO_GIORNI * GIORNO_MS;
  } else {
    lookbackMs = PRIMO_LOOKBACK_GIORNI * GIORNO_MS;
  }

  var r = _processa(cfg, lookbackMs, false);
  props.setProperty('LAST_RUN', new Date().toISOString());

  Logger.log('Fatto. Aggiunti: ' + r.aggiunti +
             ' | Già presenti (saltati): ' + r.giaPresenti +
             ' | Senza match su ActiveCampaign: ' + r.senzaMatch.join(', '));
}

// =============================================================
//  BACKFILL: recupera gli arretrati degli ultimi N giorni (default 7)
// =============================================================
function backfill(giorni) {
  giorni = giorni || 7;
  var cfg = _config();
  _assertConfig(cfg);
  var r = _processa(cfg, giorni * GIORNO_MS, false);
  PropertiesService.getScriptProperties().setProperty('LAST_RUN', new Date().toISOString());
  Logger.log('Backfill ' + giorni + ' giorni → aggiunti: ' + r.aggiunti +
             ' | già presenti: ' + r.giaPresenti +
             ' | senza match: ' + r.senzaMatch.join(', '));
}

// =============================================================
//  TEST A VUOTO (dry run): NON scrive nulla, mostra solo cosa farebbe
// =============================================================
function test_DryRun() {
  var cfg = _config();
  _assertConfig(cfg);
  var r = _processa(cfg, 3 * GIORNO_MS, true);
  Logger.log('--- DRY RUN (nessuna scrittura nel foglio) ---');
  Logger.log('Righe che verrebbero aggiunte: ' + r.aggiunti);
  Logger.log('Anteprima:\n' + (r.anteprima.join('\n') || '(nessuna)'));
  Logger.log('Già presenti nel foglio (saltati): ' + r.giaPresenti);
  Logger.log('Trovati su Circle ma NON su ActiveCampaign: ' + (r.senzaMatch.join(', ') || '(nessuno)'));
}

// =============================================================
//  CUORE DEL PROCESSO
// =============================================================
function _processa(cfg, lookbackMs, dryRun) {
  var cutoff = new Date(Date.now() - lookbackMs);

  // 1) Email recenti dallo spazio Digital Step su Circle
  var membri = _circleMembriRecenti(cfg, cutoff);

  // 2) Apri il foglio e leggi le email già presenti (per non duplicare)
  var ss = SpreadsheetApp.openById(cfg.SHEET_ID);
  var sheet = ss.getSheetByName(cfg.SHEET_NAME) || ss.insertSheet(cfg.SHEET_NAME);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(INTESTAZIONE);
    sheet.getRange(1, 1, 1, INTESTAZIONE.length).setFontWeight('bold');
  }
  var tz = ss.getSpreadsheetTimeZone();
  var emailEsistenti = _emailGiaPresenti(sheet);

  var oggi = Utilities.formatDate(new Date(), tz, 'dd/MM/yyyy');
  var r = { aggiunti: 0, giaPresenti: 0, senzaMatch: [], anteprima: [] };

  membri.forEach(function (m) {
    var email = (m.email || '').toLowerCase().trim();
    if (!email) return;
    if (emailEsistenti[email]) { r.giaPresenti++; return; }

    var ac = _acTrovaContatto(cfg, email);
    if (!ac) { r.senzaMatch.push(email); return; }

    // Colonne: Data_Check | Nome | Cognome | Email | Telefono
    var riga = [oggi, ac.firstName || '', ac.lastName || '', m.email, ac.phone || ''];

    if (dryRun) {
      r.anteprima.push(riga.join(' | '));
    } else {
      sheet.appendRow(riga);
    }
    emailEsistenti[email] = true; // evita doppioni nello stesso run
    r.aggiunti++;
  });

  return r;
}

// =============================================================
//  CIRCLE: membri dello spazio entrati dopo "cutoff"
//  (stesso endpoint del tuo vecchio script, che funzionava)
// =============================================================
function _circleMembriRecenti(cfg, cutoff) {
  var out = [];
  var page = 1;
  var cutoffMs = cutoff.getTime();

  while (true) {
    var url = 'https://app.circle.so/api/admin/v2/space_members'
            + '?space_id=' + encodeURIComponent(cfg.CIRCLE_SPACE_ID)
            + '&per_page=100'
            + '&page=' + page;
    var data = _circleGet(cfg, url);

    var recs = (data && data.records) ? data.records : [];
    if (recs.length === 0) break;

    recs.forEach(function (rr) {
      var cm = rr.community_member || {};
      if (!rr.created_at) return;
      if (new Date(rr.created_at).getTime() < cutoffMs) return; // entrato prima del cutoff
      out.push({ email: cm.email, name: cm.name });
    });

    if (data && data.has_next_page) { page++; } else { break; }
    if (page > 100) break; // salvagente
  }
  return out;
}

// Chiamata a Circle (Admin API v2, autenticazione Bearer)
function _circleGet(cfg, url) {
  var resp = UrlFetchApp.fetch(url, {
    method: 'get',
    muteHttpExceptions: true,
    headers: { 'Authorization': 'Bearer ' + cfg.CIRCLE_API_TOKEN }
  });
  var code = resp.getResponseCode();
  var body = resp.getContentText();
  var data = null;
  try { data = JSON.parse(body); } catch (e) { data = null; }

  // Circle a volte risponde 200 anche con un errore { status, message }: gestiamolo
  if (!data || (data.status && data.message && !data.records)) {
    Logger.log('Circle errore su ' + url + ' → ' + body.slice(0, 200));
    return null;
  }
  return data;
}

// =============================================================
//  ACTIVECAMPAIGN: cerca un contatto per email esatta
// =============================================================
function _acTrovaContatto(cfg, email) {
  var url = cfg.AC_API_URL.replace(/\/+$/, '')
          + '/api/3/contacts?email=' + encodeURIComponent(email);
  var data = _fetchJson(url, { method: 'get', headers: { 'Api-Token': cfg.AC_API_KEY } });
  if (data && data.contacts && data.contacts.length > 0) {
    var c = data.contacts[0];
    return { firstName: c.firstName || '', lastName: c.lastName || '', phone: c.phone || '' };
  }
  return null;
}

// =============================================================
//  UTILITY
// =============================================================
function _emailGiaPresenti(sheet) {
  var set = {};
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return set;

  // trova la colonna "Email" dall'intestazione (default: 4ª colonna)
  var header = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var col = 4;
  for (var i = 0; i < header.length; i++) {
    if (String(header[i]).toLowerCase().trim() === 'email') { col = i + 1; break; }
  }
  var valori = sheet.getRange(2, col, lastRow - 1, 1).getValues();
  valori.forEach(function (riga) {
    var e = String(riga[0] || '').toLowerCase().trim();
    if (e) set[e] = true;
  });
  return set;
}

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
    if ((code === 429 || code >= 500) && tentativi < 4) {
      Utilities.sleep(Math.pow(2, tentativi) * 1000);
      continue;
    }
    Logger.log('HTTP ' + code + ' su ' + url + '\n' + resp.getContentText().slice(0, 500));
    return null;
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
//  TEST CONNESSIONE: verifica che le chiavi rispondano
// =============================================================
function testConnessione() {
  var cfg = _config();
  _assertConfig(cfg);

  // Circle
  var c = _circleGet(cfg,
    'https://app.circle.so/api/admin/v2/space_members?space_id=' + cfg.CIRCLE_SPACE_ID + '&per_page=1');
  Logger.log('Circle risponde? ' + (c && c.records ? 'SÌ ✅ (membri nello spazio: ' + (c.count != null ? c.count : '?') + ')' : 'NO ❌ (controlla il token)'));

  // ActiveCampaign
  var a = _fetchJson(cfg.AC_API_URL.replace(/\/+$/, '') + '/api/3/contacts?limit=1',
    { method: 'get', headers: { 'Api-Token': cfg.AC_API_KEY } });
  Logger.log('ActiveCampaign risponde? ' + (a && a.meta ? 'SÌ ✅ (contatti totali: ' + a.meta.total + ')' : 'NO ❌ (controlla URL e chiave)'));

  // Foglio
  try {
    var ss = SpreadsheetApp.openById(cfg.SHEET_ID);
    Logger.log('Foglio aperto? SÌ ✅ → file "' + ss.getName() + '", scheda "' + cfg.SHEET_NAME + '"');
  } catch (e) {
    Logger.log('Foglio aperto? NO ❌ (controlla SHEET_ID)');
  }
}

// =============================================================
//  DIAGNOSTICA: prova vari endpoint/auth di Circle e logga quale risponde
// =============================================================
function diagnosticaCircle() {
  var cfg = _config();
  var sid = cfg.CIRCLE_SPACE_ID;
  var tok = cfg.CIRCLE_API_TOKEN;
  var prove = [
    ['Bearer', 'https://app.circle.so/api/admin/v2/space_members?space_id=' + sid + '&per_page=2'],
    ['Bearer', 'https://app.circle.so/api/admin/v2/community_members?per_page=2'],
    ['Bearer', 'https://app.circle.so/api/admin/v2/spaces?per_page=2'],
    ['Token',  'https://app.circle.so/api/v1/space_members?space_id=' + sid + '&per_page=2'],
    ['Bearer', 'https://app.circle.so/api/v1/space_members?space_id=' + sid + '&per_page=2'],
    ['Token',  'https://app.circle.so/api/v1/community_members?per_page=2']
  ];
  prove.forEach(function (p) {
    var schema = p[0], url = p[1];
    var resp = UrlFetchApp.fetch(url, { method: 'get', muteHttpExceptions: true,
      headers: { 'Authorization': schema + ' ' + tok } });
    var code = resp.getResponseCode();
    var body = resp.getContentText();
    var info = 'HTTP ' + code;
    var primo = body.charAt(0);
    if (primo === '{' || primo === '[') {
      try {
        var j = JSON.parse(body);
        var keys = (j && typeof j === 'object' && !Array.isArray(j)) ? Object.keys(j).join(',') : ('array, elementi: ' + j.length);
        info += ' | chiavi JSON: ' + keys;
        if (j.records) info += ' | records: ' + j.records.length;
      } catch (e) { info += ' | JSON non valido'; }
    } else {
      info += ' | pagina HTML (indirizzo sbagliato): ' + body.slice(0, 50).replace(/\n/g, ' ');
    }
    Logger.log('[' + schema + '] ' + url.replace('https://app.circle.so', '') + '\n   → ' + info);
  });
}
