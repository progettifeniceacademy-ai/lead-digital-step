/**
 * Suggeritore Bozze Fenice — versione AI (Google Gemini), 1 clic
 * ------------------------------------------------------------
 * Apri la mail di un'azienda e clicchi la bustina ✉️ a destra: l'AI legge la
 * mail e scrive SUBITO la bozza di risposta nel tuo stile, come bozza dentro
 * alla conversazione. Nessun altro pulsante da cliccare.
 *
 * Se la mail è fuori dai casi che conosce, NON inventa: te lo dice ("Non ho una
 * risposta pronta"). L'invio è SEMPRE tuo e manuale: crea solo la bozza.
 *
 * Serve una chiave Gemini gratuita salvata nelle Proprietà script come
 * GEMINI_API_KEY (vedi README).
 * ------------------------------------------------------------
 */

// Prova questi modelli in ordine, usa il primo che risponde (per aggirare i
// limiti di quota gratuita di un singolo modello).
var MODELLI = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-flash-latest', 'gemini-1.5-flash'];

// =============================================================
//  CONOSCENZA / STILE DI MARTA (il "cervello" della risposta)
// =============================================================
var ISTRUZIONI =
  'Sei l\'assistente email di Marta Fanduzza, che gestisce le collaborazioni per ' +
  'Fenice Academy Srl (accademia di formazione digitale). Il tuo compito: leggere la ' +
  'mail di un\'azienda e scrivere la BOZZA di risposta che scriverebbe Marta. Non invii ' +
  'nulla, scrivi solo il testo.\n\n' +

  'COSA PROPONE FENICE ACADEMY:\n' +
  '- Studenti già formati e operativi in ambito digitale (Social Media Manager, ' +
  'Copywriter & SEO, Ecommerce Manager, Project Manager, Graphic Designer, Data Analyst, ' +
  'Web Developer, ecc.).\n' +
  '- Fanno un\'esperienza pratica in azienda per concludere il percorso formativo: NON ' +
  'retribuita, durata 3-6 mesi.\n' +
  '- NON sono stage o tirocini curricolari o extracurricolari; NON serve attivare ' +
  'tirocini/stage/consulenti del lavoro; non si lavora con CV o portfolio.\n' +
  '- Si lavora SOLO DA REMOTO: Fenice non fa collaborazioni in presenza.\n' +
  '- Obiettivo di ogni risposta: arrivare a una breve call conoscitiva (circa 15 minuti, ' +
  'su Google Meet) in cui si spiega tutto.\n\n' +

  'COME RISPONDERE in base alla mail:\n' +
  '- INTERESSATA / vuole approfondire: ringrazia con calore, proponi una breve call di ' +
  '~15 min su Meet e chiedi un recapito telefonico. NON conosci l\'agenda di Marta: dove ' +
  'andrebbero gli orari metti il segnaposto «[LE TUE DISPONIBILITÀ]».\n' +
  '- DOMANDA/OBIEZIONE (è curricolare? è vincolante? è retribuito? serve un contratto?): ' +
  'spiega che "i nostri non sono stage curricolari o extracurricolari, sono proseguimenti ' +
  'di percorsi formativi in cui vengono delegate agli studenti delle task più operative ' +
  'senza una retribuzione; è un modo per applicare quanto hanno imparato e, per voi, per ' +
  'testare delle risorse che se poi vi piacciono potete tenere. Non è necessario attivare ' +
  'tirocini, stage o consulenti del lavoro." Poi proponi la call.\n' +
  '- Vuole persone SOLO IN PRESENZA / non fa lavoro da remoto: siccome noi lavoriamo solo ' +
  'da remoto, spiega gentilmente che al momento non è compatibile, MA chiedi quali ' +
  'professioni cercano e in quale città si trovano, così da valutare un inserimento più ' +
  'avanti o verificare se ci sono studenti nella loro zona. Proponi di tenere il contatto.\n' +
  '- Ti manda un suo LINK di prenotazione (Calendar/Calendly): ringrazia e di\' che prenoti ' +
  'volentieri tramite il loro link.\n' +
  '- NON interessata / declina: ringrazia cordialmente e lascia la porta aperta (tieni il ' +
  'contatto in database per il futuro).\n\n' +

  'STILE:\n' +
  '- Italiano, tono caloroso ma professionale, frasi brevi. Dai del "lei" (se però la mail ' +
  'dà chiaramente del tu, rispondi a tono).\n' +
  '- Inizia con "Buongiorno [Nome]," se conosci il nome, altrimenti "Buongiorno,".\n' +
  '- Chiudi SEMPRE con la firma "MF" e nient\'altro dopo.\n' +
  '- Espressioni tipiche: "con molto piacere!", "Mi fa piacere!", "Attendo un suo ' +
  'riscontro, grazie mille!", "A presto".\n\n' +

  'REGOLA IMPORTANTE — quando NON sai rispondere:\n' +
  '- Se la mail non rientra nei casi qui sopra, o chiede cose che non conosci (prezzi, ' +
  'questioni legali/contrattuali specifiche, argomenti fuori contesto), NON inventare: ' +
  'rispondi ESATTAMENTE e SOLO con la parola NON_SO_RISPONDERE.\n\n' +

  'OUTPUT:\n' +
  '- Restituisci SOLO il testo della mail (dal saluto alla firma "MF"). Niente oggetto, ' +
  'niente virgolette, nessun commento o spiegazione tua.';

// =============================================================
//  1 CLIC: apri la bustina → legge la mail → crea la bozza
// =============================================================
function onGmailMessageOpen(e) {
  try {
    GmailApp.setCurrentMessageAccessToken(e.gmail.accessToken);
    var message = GmailApp.getMessageById(e.gmail.messageId);

    var apiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
    if (!apiKey) {
      return [_scheda('Manca la chiave',
        'Aggiungi la chiave GEMINI_API_KEY nelle Proprietà script (vedi README).')];
    }

    var testoMail = _soloUltimaMail(message.getPlainBody() || '');
    var oggetto = message.getSubject() || '';
    var nome = _primoNome(message.getFrom());

    var risposta = _generaConGemini(apiKey, oggetto, testoMail, nome);

    if (risposta && risposta.error) {
      return [_scheda('Errore tecnico', 'L\'AI non ha risposto: ' + risposta.error)];
    }
    if (!risposta || !risposta.testo) {
      return [_scheda('Non riuscito',
        'Non sono riuscito a generare la bozza. Riprova richiudendo e riaprendo il componente.')];
    }
    if (risposta.testo.indexOf('NON_SO_RISPONDERE') !== -1) {
      return [_scheda('⚠️ Non ho una risposta pronta',
        'Questa mail esce dai casi che conosco: preferisco non inventare. ' +
        'Rispondi tu a mano (se è un caso ricorrente, dimmelo così te lo aggiungo).')];
    }

    message.createDraftReply(risposta.testo);
    return [_scheda('✅ Bozza creata',
      'La trovi in fondo alla conversazione. Rileggila, modificala e invia tu.')];

  } catch (err) {
    return [_scheda('Errore', 'Qualcosa è andato storto: ' + err.message)];
  }
}

// =============================================================
//  CHIAMATA A GEMINI
// =============================================================
function _generaConGemini(apiKey, oggetto, testoMail, nome) {
  var promptUtente =
    'Referente (se noto): ' + (nome || '(non indicato)') + '\n' +
    'Oggetto della mail: ' + oggetto + '\n\n' +
    'Ecco la mail dell\'azienda a cui rispondere:\n---\n' + testoMail + '\n---\n\n' +
    'Scrivi la bozza di risposta di Marta.';

  // Provo prima il modello che ha già funzionato l'ultima volta (più veloce),
  // poi gli altri come riserva.
  var props = PropertiesService.getScriptProperties();
  var preferito = props.getProperty('MODELLO_OK');
  var lista = MODELLI.slice();
  if (preferito && lista.indexOf(preferito) !== -1) {
    lista = [preferito].concat(lista.filter(function (m) { return m !== preferito; }));
  }

  var ultimo = '';
  var quotaPiena = false;
  for (var i = 0; i < lista.length; i++) {
    // Spazio ampio per il testo; sui modelli 2.5 disattivo il "ragionamento"
    // (altrimenti si mangia lo spazio e tronca la risposta).
    var genConfig = { temperature: 0.4, maxOutputTokens: 2048 };
    if (/2\.5|latest/.test(lista[i])) genConfig.thinkingConfig = { thinkingBudget: 0 };
    var payload = {
      systemInstruction: { parts: [{ text: ISTRUZIONI }] },
      contents: [{ role: 'user', parts: [{ text: promptUtente }] }],
      generationConfig: genConfig
    };
    var opzioni = {
      method: 'post', contentType: 'application/json',
      payload: JSON.stringify(payload), muteHttpExceptions: true
    };
    var url = 'https://generativelanguage.googleapis.com/v1beta/models/' +
      lista[i] + ':generateContent?key=' + encodeURIComponent(apiKey);
    var resp = UrlFetchApp.fetch(url, opzioni);
    var code = resp.getResponseCode();
    var body = resp.getContentText();

    if (code === 200) {
      try {
        var data = JSON.parse(body);
        var testo = data.candidates && data.candidates[0] && data.candidates[0].content &&
          data.candidates[0].content.parts && data.candidates[0].content.parts[0] &&
          data.candidates[0].content.parts[0].text;
        if (testo) {
          props.setProperty('MODELLO_OK', lista[i]); // ricordo quello che funziona
          return { testo: testo.trim() };
        }
        ultimo = 'risposta vuota (' + lista[i] + ')';
      } catch (err) {
        ultimo = 'risposta non leggibile (' + lista[i] + ')';
      }
    } else {
      if (code === 429) quotaPiena = true;
      ultimo = 'HTTP ' + code + ' su ' + lista[i] + ' — ' + body.slice(0, 150);
    }
  }

  if (quotaPiena) {
    return { error: 'quota Gemini esaurita su tutti i modelli gratuiti. Aspetta qualche ' +
      'minuto e riprova; se persiste, la chiave ha finito il credito gratuito giornaliero.' };
  }
  return { error: ultimo };
}

// =============================================================
//  AIUTANTI
// =============================================================
function _soloUltimaMail(body) {
  var marcatori = [
    /\nIl giorno .* ha scritto:/, /\nOn .* wrote:/,
    /\n-----Messaggio originale-----/, /\n________________________________/,
    /\nFrom:\s/, /\nDa:\s/
  ];
  var taglio = body.length;
  marcatori.forEach(function (re) {
    var m = body.match(re);
    if (m && m.index < taglio) taglio = m.index;
  });
  return body.slice(0, taglio).trim().slice(0, 4000);
}

function _primoNome(from) {
  if (!from) return '';
  var nome = from.replace(/<[^>]*>/, '').replace(/["']/g, '').trim();
  if (!nome || nome.indexOf('@') !== -1) return '';
  var primo = nome.split(/\s+/)[0];
  if (primo.length < 2) return '';
  return primo.charAt(0).toUpperCase() + primo.slice(1);
}

function _scheda(titolo, testo) {
  var section = CardService.newCardSection()
    .addWidget(CardService.newTextParagraph().setText('<b>' + titolo + '</b>'))
    .addWidget(CardService.newTextParagraph().setText(testo));
  return CardService.newCardBuilder()
    .setHeader(CardService.newCardHeader().setTitle('Suggeritore Bozze Fenice'))
    .addSection(section)
    .build();
}

/**
 * Eseguila UNA volta dall'editor (menu Esegui) per concedere l'autorizzazione a
 * contattare internet (serve per chiamare Gemini). Dopo, puoi ignorarla.
 */
function autorizza() {
  UrlFetchApp.fetch('https://www.google.com');
}
