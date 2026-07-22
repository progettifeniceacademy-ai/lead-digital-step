/**
 * Suggeritore Bozze Fenice — componente aggiuntivo di Gmail
 * ------------------------------------------------------------
 * Mentre stai SCRIVENDO una risposta, apri il componente e con un click il testo
 * viene inserito DIRETTAMENTE nella mail che stai scrivendo (non crea bozze
 * separate: niente da cercare nella cartella Bozze). Poi controlli, sistemi nome
 * e orari, e invii tu.
 *
 * I testi sono ricostruiti dalle risposte vere di Marta. Quattro casi ricorrenti:
 *   ① INTERESSATO   → ringrazi, proponi tu la call con le tue disponibilità,
 *                     chiedi un recapito telefonico, mandi poi il Meet
 *   ② SPIEGAZIONE   → spieghi che non sono stage/tirocini ma proseguimenti di
 *                     percorso, e chiudi proponendo una call
 *   ③ ZONA          → l'azienda vuole gente solo in loco e non ne hai in zona:
 *                     tieni il contatto in database
 *   ④ LORO LINK     → l'azienda ti ha mandato un suo link di prenotazione
 *
 * Preferenze: firma "MF", sempre del "lei".
 * ------------------------------------------------------------
 */

// =============================================================
//  I TUOI TESTI (modelli pronti) — modificali pure a piacere
// =============================================================
// Segnaposto:
//   [SALUTO] → "Buongiorno Giacomo" (o solo "Buongiorno" se non scrivi il nome)
//   [SLOT]   → le disponibilità che scrivi nel campo (solo dove serve)
var TESTO = {
  interessato:
    '[SALUTO], con molto piacere!\n\n' +
    'Per una breve call di circa 15 minuti io sarei disponibile [SLOT]. Mi faccia ' +
    'sapere quale preferisce e le mando subito l’invito con il link del Meet.\n' +
    'Le chiederei intanto anche un recapito telefonico.\n\n' +
    'A presto e grazie,\n' +
    'MF',

  spiegazione:
    '[SALUTO],\n\n' +
    'i nostri non sono stage curricolari o extracurricolari, sono proseguimenti di ' +
    'percorsi formativi in cui vengono delegate agli studenti delle task più operative ' +
    'senza una retribuzione: è un modo per applicare quanto hanno imparato e, per voi, ' +
    'per testare delle risorse che se poi vi piacciono potete tenere (proponendo a quel ' +
    'punto anche qualcosa di più strutturato). Per questo non è necessario attivare ' +
    'tirocini, stage o consulenti del lavoro.\n\n' +
    'Se le fa piacere possiamo organizzare una breve call così le spiego tutto nel ' +
    'dettaglio: io sarei disponibile [SLOT].\n\n' +
    'Attendo un suo riscontro, grazie mille!\n' +
    'MF',

  zona:
    '[SALUTO],\n\n' +
    'la ringrazio! Al momento purtroppo non ho studenti disponibili nella vostra zona. ' +
    'Se per voi va bene tengo il vostro contatto in database e vi riaggiorno non appena ' +
    'avrò delle risorse in zona.\n\n' +
    'A presto e grazie,\n' +
    'MF',

  link:
    '[SALUTO],\n\n' +
    'perfetto, grazie mille! Prenoto subito una fascia tramite il vostro link.\n\n' +
    'A presto,\n' +
    'MF'
};

// Cosa scrivere in [SLOT] se lasci vuoto il campo "Disponibilità".
var SLOT_PROMEMORIA = '«[inserisci qui le tue disponibilità, es. mer 23 dalle 9 alle 11.30 – gio 24 dalle 14 alle 18]»';

// =============================================================
//  SCHEDA (quando apri il componente mentre scrivi una risposta)
// =============================================================
function onComposeOpen(e) {
  var section = CardService.newCardSection();

  section.addWidget(CardService.newTextParagraph().setText(
    'Scegli la risposta: il testo entra <b>dentro la mail che stai scrivendo</b>.'));

  section.addWidget(CardService.newTextInput()
    .setFieldName('nome')
    .setTitle('Nome referente (facoltativo)')
    .setHint('es. Giacomo — se vuoto scrive solo “Buongiorno,”'));

  section.addWidget(CardService.newTextInput()
    .setFieldName('slots')
    .setTitle('Disponibilità da proporre (facoltativo)')
    .setHint('es. mer 23 dalle 9 alle 11.30 – gio 24 dalle 14 alle 18'));

  var bottoni = [
    { chiave: 'interessato', testo: '①  Interessato → proponi call' },
    { chiave: 'spiegazione', testo: '②  Spiega la collaborazione' },
    { chiave: 'zona',        testo: '③  Non è della vostra zona (database)' },
    { chiave: 'link',        testo: '④  Prenoto col vostro link' }
  ];

  bottoni.forEach(function (b) {
    section.addWidget(CardService.newTextButton()
      .setText(b.testo)
      .setOnClickAction(CardService.newAction()
        .setFunctionName('inserisciTesto')
        .setParameters({ scenario: b.chiave })));
  });

  return CardService.newCardBuilder()
    .setHeader(CardService.newCardHeader().setTitle('Suggeritore Bozze Fenice'))
    .addSection(section)
    .build();
}

// =============================================================
//  AZIONE: inserisce il testo scelto DENTRO la risposta aperta
// =============================================================
function inserisciTesto(e) {
  var scenario = e.parameters.scenario;
  var nome = (e.formInput && e.formInput.nome) ? String(e.formInput.nome).trim() : '';
  var slot = (e.formInput && e.formInput.slots) ? String(e.formInput.slots).trim() : '';

  var saluto = nome
    ? ('Buongiorno ' + nome.charAt(0).toUpperCase() + nome.slice(1))
    : 'Buongiorno';

  var corpo = TESTO[scenario]
    .replace('[SALUTO]', saluto)
    .replace('[SLOT]', slot || SLOT_PROMEMORIA);

  var html = corpo.replace(/\n/g, '<br>');

  var azione = CardService.newUpdateDraftBodyAction()
    .addUpdateContent(html, CardService.ContentType.MUTABLE_HTML)
    .setUpdateType(CardService.UpdateDraftBodyType.IN_PLACE_INSERT);

  return CardService.newComposeActionResponseBuilder()
    .setUpdateDraftBodyAction(azione)
    .build();
}
