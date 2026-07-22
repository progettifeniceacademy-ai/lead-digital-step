# Suggeritore Bozze Fenice — scrive la risposta dentro Gmail

Componente aggiuntivo di Gmail. **Mentre scrivi una risposta**, apri il componente
e con un click il testo entra **direttamente nella mail che stai scrivendo** — non
crea bozze separate da cercare. Poi controlli, sistemi nome e orari, e invii tu.

I testi sono ricostruiti dalle risposte vere di Marta. Quattro casi ricorrenti:

| Pulsante | Quando | Cosa scrive |
|---|---|---|
| **① Interessato → call** | l'azienda è interessata | ringrazi, proponi la call con le tue disponibilità, chiedi un recapito telefonico, mandi poi il Meet |
| **② Spiega la collaborazione** | domanda/obiezione ("è curricolare? vincolante?") | "i nostri non sono stage... sono proseguimenti di percorsi formativi..." + proponi call |
| **③ Non è della vostra zona** | vogliono gente solo in loco e non ne hai in zona | tieni il contatto in database e li riaggiorni |
| **④ Prenoto col vostro link** | ti mandano un loro link (Calendar/Calendly) | confermi che prenoti tramite il loro link |

Nella scheda ci sono due campi facoltativi: **Nome referente** e **Disponibilità**.
Se li compili finiscono già nel testo; se li lasci vuoti trovi un promemoria da
riempire al volo dentro la mail.

## Installazione / aggiornamento

Se è la prima volta, o se stai aggiornando da una versione precedente:

1. Su **script.google.com** apri il progetto **Suggeritore Bozze** (o creane uno nuovo).
2. **`Codice.gs`**: cancella tutto e incolla il contenuto di `SuggeritoreBozze.gs`.
3. **`appsscript.json`** (se non lo vedi: ingranaggio ⚙️ → spunta *"Mostra il file
   manifest appsscript.json nell'editor"*): cancella tutto e incolla il contenuto
   di `appsscript.json`.
4. Salva (💾).
5. **Esegui il deployment → Verifica deployment**. Se risulta già installato clicca
   **Disinstalla** e poi **Installa** di nuovo (serve perché sono cambiati i
   permessi). **Fine**.
6. Ricarica Gmail. La prima volta che usi il componente ti chiede di **autorizzare**:
   accetta (Avanzate → Consenti).

## Come si usa

1. Apri la mail dell'azienda e clicca **Rispondi** (si apre il riquadro di risposta).
2. Nella **barra in basso del riquadro di risposta** clicca l'icona del componente
   (la bustina ✉️ tra le icone degli allegati/add-on).
3. (Facoltativo) scrivi **Nome referente** e **Disponibilità**.
4. Clicca il pulsante del caso giusto (①–④): il testo compare **nella risposta**.
5. Controlli, sistemi, e invii tu.

## Note

- **Firma-immagine.** Il testo finisce con "MF"; la tua firma-immagine in calce la
  aggiunge Gmail come sempre quando scrivi a mano (il componente non la tocca).
- **Del "lei".** I testi danno del lei; se ti danno del tu, sistemi prima di inviare.
- **Permessi.** Il componente usa solo il permesso per *inserire testo nella
  risposta che stai scrivendo*. Non legge le altre mail e non invia niente.

## Modificare i testi

I quattro modelli sono all'inizio di `SuggeritoreBozze.gs`, nella variabile `TESTO`.
Cambiali quando vuoi: salva e ricarica Gmail. I segnaposto `[SALUTO]` e `[SLOT]`
si riempiono da soli.

## Vuoi che si adatti da sola a ogni mail?

Questa è la versione a **modelli fissi** (gratis, immediata, affidabile). Se un
domani vuoi che il testo venga *scritto su misura* leggendo la singola mail, si può
collegare Claude (AI): stessa interfaccia, ma serve una chiave API a pagamento
(pochi centesimi a mail). Il codice è predisposto per aggiungerla in seguito.
