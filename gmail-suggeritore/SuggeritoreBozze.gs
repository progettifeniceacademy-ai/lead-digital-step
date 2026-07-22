/**
 * Suggeritore Bozze Fenice — versione AI (Google Gemini)
 * ------------------------------------------------------------
 * Apri la mail di un'azienda, clicchi la bustina e clicchi "Scrivi la bozza":
 * l'AI legge la mail e scrive la BOZZA di risposta nel tuo stile, come bozza
 * dentro alla conversazione. Se la mail è fuori dai casi che conosce, NON
 * inventa: te lo dice ("Non ho una risposta pronta").
 *
 * L'invio è SEMPRE tuo e manuale: il componente crea solo la bozza, non manda
 * mai niente.
 *
 * Serve una chiave Gemini gratuita salvata nelle Proprietà script come
 * GEMINI_API_KEY (vedi README).
 * ------------------------------------------------------------
 */

var MODELLO = 'gemini-2.0-flash'; // se dà errore di modello, prova 'gemini-1.5-flash'

// =============================================================
//  CONOSCENZA / STILE DI MARTA (è qui il "cervello" della risposta)
//  Modifica questo testo per cambiare come risponde l'AI.
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
//  SCHEDA (quando apri il componente su una mail)
// =============================================================
function onGmailMessageOpen(e) {
  var section = CardService.newCardSection();
  section.addWidget(CardService.newTextParagraph().setText(
    'Clicca qui sotto: leggo questa mail e scrivo la bozza di risposta nel tuo stile, ' +
    'come bozza nella conversazione. La rileggi e la invii tu.'));
  section.addWidget(CardService.newTextButton()
    .setText('✍️  Scrivi la bozza di risposta')
    .setTextButtonStyle(CardService.TextButtonStyle.FILLED)
    .setOnClickAction(CardService.newAction().setFunctionName('scriviBozza')));

  return [CardService.newCardBuilder()
    .setHeader(CardService.newCardHeader().setTitle('Suggeritore Bozze Fenice'))
    .addSection(section)
    .build()];
}

// =============================================================
//  AZIONE: legge la mail, genera con l'AI, crea la bozza
// =============================================================
function scriviBozza(e) {
  try {
    GmailApp.setCurrentMessageAccessToken(e.gmail.accessToken);
    var message = GmailApp.getMessageById(e.gmail.messageId);
    var thread = message.getThread();

    if (_esisteBozzaNelThread(thread.getId())) {
      return _schedaEsito('Bozza già presente 👇',
        'C\'è già una bozza in fondo a questa conversazione. Rileggila e invia tu ' +
        '(cancellala se vuoi rigenerarla).');
    }

    var apiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
    if (!apiKey) {
      return _schedaEsito('Manca la chiave',
        'Aggiungi la chiave GEMINI_API_KEY nelle Proprietà script (vedi README).');
    }

    var testoMail = _soloUltimaMail(message.getPlainBody() || '');
    var oggetto = message.getSubject() || '';
    var nome = _primoNome(message.getFrom());

    var risposta = _generaConGemini(apiKey, oggetto, testoMail, nome);

    if (risposta && risposta.error) {
      return _schedaEsito('Errore tecnico',
        'L\'AI non ha risposto: ' + risposta.error + '\nRiprova tra poco o segnalamelo.');
    }
    if (!risposta || !risposta.testo) {
      return _schedaEsito('Non riuscito',
        'Non sono riuscito a generare la bozza. Riprova tra poco.');
    }
    if (risposta.testo.indexOf('NON_SO_RISPONDERE') !== -1) {
      return _schedaEsito('⚠️ Non ho una risposta pronta',
        'Questa mail esce dai casi che conosco: preferisco non inventare. ' +
        'Rispondi tu a mano (e se è un caso ricorrente, dimmelo così te lo aggiungo).');
    }

    message.createDraftReply(risposta.testo);
    return _schedaEsito('✅ Bozza creata',
      'La trovi in fondo alla conversazione. Rileggila, modificala e invia tu.');

  } catch (err) {
    return _schedaEsito('Errore', 'Qualcosa è andato storto: ' + err.message);
  }
}

// =============================================================
//  CHIAMATA A GEMINI
// =============================================================
function _generaConGemini(apiKey, oggetto, testoMail, nome) {
  var url = 'https://generativelanguage.googleapis.com/v1beta/models/' +
    MODELLO + ':generateContent?key=' + encodeURIComponent(apiKey);

  var promptUtente =
    'Referente (se noto): ' + (nome || '(non indicato)') + '\n' +
    'Oggetto della mail: ' + oggetto + '\n\n' +
    'Ecco la mail dell\'azienda a cui rispondere:\n---\n' + testoMail + '\n---\n\n' +
    'Scrivi la bozza di risposta di Marta.';

  var payload = {
    systemInstruction: { parts: [{ text: ISTRUZIONI }] },
    contents: [{ role: 'user', parts: [{ text: promptUtente }] }],
    generationConfig: { temperature: 0.4, maxOutputTokens: 700 }
  };

  var resp = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });

  var code = resp.getResponseCode();
  var body = resp.getContentText();
  if (code !== 200) {
    return { error: 'HTTP ' + code + ' — ' + body.slice(0, 300) };
  }

  try {
    var data = JSON.parse(body);
    var testo = data.candidates &&
      data.candidates[0] &&
      data.candidates[0].content &&
      data.candidates[0].content.parts &&
      data.candidates[0].content.parts[0] &&
      data.candidates[0].content.parts[0].text;
    if (!testo) return { error: 'risposta vuota dal modello' };
    return { testo: testo.trim() };
  } catch (err) {
    return { error: 'risposta non leggibile' };
  }
}

// =============================================================
//  AIUTANTI
// =============================================================

// Tiene solo l'ultima mail, taglia la cronologia citata sotto.
function _soloUltimaMail(body) {
  var marcatori = [
    /\nIl giorno .* ha scritto:/,
    /\nOn .* wrote:/,
    /\n-----Messaggio originale-----/,
    /\n________________________________/,
    /\nDa:\s/
  ];
  var taglio = body.length;
  marcatori.forEach(function (re) {
    var m = body.match(re);
    if (m && m.index < taglio) taglio = m.index;
  });
  var testo = body.slice(0, taglio).trim();
  return testo.slice(0, 4000); // limite di sicurezza
}

// Nome di battesimo dal campo "From"; se non leggibile torna "".
function _primoNome(from) {
  if (!from) return '';
  var nome = from.replace(/<[^>]*>/, '').replace(/["']/g, '').trim();
  if (!nome || nome.indexOf('@') !== -1) return '';
  var primo = nome.split(/\s+/)[0];
  if (primo.length < 2) return '';
  return primo.charAt(0).toUpperCase() + primo.slice(1);
}

// C'è già una bozza in questo thread? (evita doppioni)
function _esisteBozzaNelThread(threadId) {
  try {
    var drafts = GmailApp.getDrafts();
    for (var i = 0; i < drafts.length; i++) {
      try {
        if (drafts[i].getMessage().getThread().getId() === threadId) return true;
      } catch (e) {}
    }
  } catch (e) {}
  return false;
}

/**
 * Eseguila UNA volta dall'editor (menu Esegui) per concedere l'autorizzazione a
 * contattare internet (serve per chiamare Gemini). Dopo il consenso puoi anche
 * ignorarla: serve solo la prima volta.
 */
function autorizza() {
  UrlFetchApp.fetch('https://www.google.com');
  GmailApp.getInboxUnreadCount();
}

function _schedaEsito(titolo, testo) {
  var section = CardService.newCardSection()
    .addWidget(CardService.newTextParagraph().setText('<b>' + titolo + '</b>'))
    .addWidget(CardService.newTextParagraph().setText(testo));
  return CardService.newActionResponseBuilder()
    .setNavigation(CardService.newNavigation().updateCard(
      CardService.newCardBuilder()
        .setHeader(CardService.newCardHeader().setTitle('Suggeritore Bozze Fenice'))
        .addSection(section)
        .build()))
    .build();
}
