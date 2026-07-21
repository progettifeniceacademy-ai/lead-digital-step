/**
 * Suggeritore Bozze Fenice — componente aggiuntivo di Gmail
 * ------------------------------------------------------------
 * Aggiunge un pulsante nella barra laterale di Gmail. Quando apri la risposta
 * di un'azienda e clicchi, ti crea la BOZZA di risposta dentro al thread, nel
 * tuo stile. Non invia mai niente: prepara solo la bozza, che tu leggi,
 * sistemi (soprattutto gli orari) e invii con un click.
 *
 * Come funziona:
 *  - onGmailMessageOpen(e) → disegna la scheda con i pulsanti quando apri una mail.
 *    Legge la mail aperta e "indovina" quale delle 3 risposte serve, mettendola
 *    per prima come consigliata. Tu puoi comunque scegliere qualsiasi pulsante.
 *  - I 3 pulsanti creano la bozza corrispondente:
 *      1) INTERESSATO      → ringrazi e proponi tu una call con 2 fasce orarie
 *      2) SPIEGAZIONE      → spieghi cos'è la collaborazione (non è stage/tirocinio)
 *                            e chiudi proponendo una call
 *      3) LORO LINK        → l'azienda ti ha mandato un suo link: confermi che prenoti
 *
 * Preferenze impostate:
 *  - firma "MF"
 *  - sempre del "lei"
 *  - puoi scrivere le fasce orarie nel campo in alto e finiscono già nella bozza
 * ------------------------------------------------------------
 */

// =============================================================
//  I TUOI TESTI (modelli pronti) — modificali pure a piacere
// =============================================================
// Segnaposto disponibili:
//   [SALUTO]  → "Buongiorno Marco" (o solo "Buongiorno" se non c'è il nome)
//   [SLOT]    → le fasce orarie che scrivi nel campo, oppure un promemoria
var TESTO = {
  interessato:
    '[SALUTO],\n' +
    'grazie mille per il riscontro, mi fa piacere!\n\n' +
    'Volentieri organizziamo una breve call per approfondire e valutare insieme ' +
    'una possibile collaborazione. Le propongo [SLOT]: mi faccia sapere quale ' +
    'preferisce e le invio subito l’invito.\n\n' +
    'Resto in attesa di un suo riscontro, a presto!\n' +
    'MF',

  spiegazione:
    '[SALUTO], molto piacere.\n\n' +
    'Le rispondo volentieri: non si tratta di stage curricolari o extracurricolari, ' +
    'ma di proseguimenti di percorsi formativi in cui agli studenti vengono affidate ' +
    'delle task più operative, senza retribuzione e senza necessità di attivare ' +
    'tirocini o consulenti del lavoro. È un modo per applicare quanto hanno imparato ' +
    'e, per voi, per testare una risorsa che — se vi convince — potete poi ' +
    'trattenere, proponendole a quel punto qualcosa di più strutturato.\n\n' +
    'Se le fa piacere, fissiamo una breve call così le spiego tutto nel dettaglio: ' +
    'le propongo [SLOT].\n\n' +
    'Attendo un suo riscontro, grazie mille!\n' +
    'MF',

  link:
    '[SALUTO],\n' +
    'grazie mille per il riscontro! Perfetto, prenoto una fascia tramite il vostro link.\n\n' +
    'A presto e grazie,\n' +
    'MF'
};

// Cosa scrivere in [SLOT] se il campo "fasce orarie" è vuoto.
var SLOT_PROMEMORIA = '«[inserisci 2 fasce, es. giovedì 24/07 ore 15:00 oppure venerdì 25/07 ore 10:30]»';

// =============================================================
//  SCHEDA (quello che vedi quando apri una mail)
// =============================================================
function onGmailMessageOpen(e) {
  var testoMail = '';
  try {
    GmailApp.setCurrentMessageAccessToken(e.gmail.accessToken);
    testoMail = GmailApp.getMessageById(e.gmail.messageId).getPlainBody() || '';
  } catch (err) {
    testoMail = '';
  }

  var consigliato = _indovinaScenario(testoMail); // 'interessato' | 'spiegazione' | 'link'
  return [_costruisciScheda(consigliato)];
}

// Scheda mostrata quando apri il componente dalla home (senza una mail aperta).
function onHomepage(e) {
  var card = CardService.newCardBuilder()
    .setHeader(CardService.newCardHeader().setTitle('Suggeritore Bozze Fenice'))
    .addSection(CardService.newCardSection().addWidget(
      CardService.newTextParagraph().setText(
        'Apri la risposta di un’azienda e qui compariranno i pulsanti per ' +
        'creare la bozza pronta. Ricordati: la bozza non viene mai inviata, la ' +
        'invii sempre tu.')))
    .build();
  return [card];
}

function _costruisciScheda(consigliato) {
  var etichette = {
    interessato: 'Bozza: interessato + proponi call',
    spiegazione: 'Bozza: spiega la collaborazione',
    link: 'Bozza: prenoto col vostro link'
  };
  var nomiScenari = { interessato: 'Interessato', spiegazione: 'Spiegazione', link: 'Loro link' };

  var section = CardService.newCardSection();

  section.addWidget(CardService.newTextParagraph().setText(
    'Risposta che sembra più adatta: <b>' + nomiScenari[consigliato] + '</b>. ' +
    'Puoi comunque scegliere qualsiasi pulsante.'));

  // Campo per le fasce orarie (facoltativo): finisce dentro la bozza.
  section.addWidget(CardService.newTextInput()
    .setFieldName('slots')
    .setTitle('Fasce orarie da proporre (facoltativo)')
    .setHint('es. gio 24/07 ore 15:00 oppure ven 25/07 ore 10:30'));

  // Ordino i pulsanti: prima quello consigliato.
  var ordine = [consigliato].concat(['interessato', 'spiegazione', 'link'].filter(function (k) {
    return k !== consigliato;
  }));

  ordine.forEach(function (chiave, i) {
    var testoBottone = etichette[chiave] + (i === 0 ? '  ⭐' : '');
    section.addWidget(CardService.newTextButton()
      .setText(testoBottone)
      .setTextButtonStyle(i === 0 ? CardService.TextButtonStyle.FILLED : CardService.TextButtonStyle.TEXT)
      .setOnClickAction(CardService.newAction()
        .setFunctionName('creaBozza')
        .setParameters({ scenario: chiave })));
  });

  return CardService.newCardBuilder()
    .setHeader(CardService.newCardHeader().setTitle('Suggeritore Bozze Fenice'))
    .addSection(section)
    .build();
}

// =============================================================
//  AZIONE: crea la bozza (la chiamano tutti e 3 i pulsanti)
// =============================================================
function creaBozza(e) {
  var scenario = e.parameters.scenario;
  var slot = (e.formInput && e.formInput.slots) ? String(e.formInput.slots).trim() : '';

  try {
    GmailApp.setCurrentMessageAccessToken(e.gmail.accessToken);
    var message = GmailApp.getMessageById(e.gmail.messageId);

    var saluto = _saluto(message.getFrom());
    var corpo = TESTO[scenario]
      .replace('[SALUTO]', saluto)
      .replace('[SLOT]', slot || SLOT_PROMEMORIA);

    message.createDraftReply(corpo);

    return _notifica('Bozza creata! La trovi in fondo al thread, pronta da controllare e inviare.');
  } catch (err) {
    return _notifica('Non sono riuscito a creare la bozza: ' + err.message);
  }
}

// =============================================================
//  AIUTANTI
// =============================================================

// "Buongiorno Marco" prendendo il nome dal mittente; se non c'è, solo "Buongiorno".
function _saluto(from) {
  var nome = _primoNome(from);
  return nome ? ('Buongiorno ' + nome) : 'Buongiorno';
}

// Estrae il nome di battesimo dal campo "From" (es. "Marco Rossi <m@x.it>" → "Marco").
// Se il mittente non ha un nome leggibile (es. "info@azienda.it"), torna "".
function _primoNome(from) {
  if (!from) return '';
  var nome = from.replace(/<[^>]*>/, '').replace(/["']/g, '').trim();
  if (!nome || nome.indexOf('@') !== -1) return '';
  var primo = nome.split(/\s+/)[0];
  // Evita nomi "aziendali" tutti maiuscoli o palesemente non-nomi.
  if (primo.length < 2) return '';
  return primo.charAt(0).toUpperCase() + primo.slice(1);
}

// Indovina quale risposta serve leggendo il testo della mail dell'azienda.
function _indovinaScenario(testo) {
  var t = (testo || '').toLowerCase();

  // 1) L'azienda ha mandato un SUO link di prenotazione?
  if (/calendar\.app\.google|calendly\.com|cal\.com|hubspot|outlook\.office|prenot\w*\s+un\s+appuntamento|tramite\s+questo\s+link|questo\s+link:/.test(t)) {
    return 'link';
  }

  // 2) Ha fatto una domanda/obiezione tipica (serve la spiegazione)?
  if (/curricolar|extracurricolar|vincolant|in\s+presenza|retribu|rimbors|tirocin|\bstage\b|consulente\s+del\s+lavoro|come\s+funziona|maggiori\s+(info|informazioni)|più\s+(info|dettagli)|che\s+cosa|di\s+cosa\s+si\s+tratta|contratto/.test(t)) {
    return 'spiegazione';
  }

  // 3) Altrimenti: interessato, proponi la call.
  return 'interessato';
}

function _notifica(testo) {
  return CardService.newActionResponseBuilder()
    .setNotification(CardService.newNotification().setText(testo))
    .build();
}
