# Suggeritore Bozze Fenice — il tuo pulsante dentro Gmail

Aggiunge un'icona nella **barra laterale destra di Gmail**. Apri la risposta di
un'azienda, clicchi un pulsante e ti compare la **bozza di risposta già scritta**
nel thread, nel tuo stile. **Non invia mai niente**: prepara solo la bozza, che
tu leggi, sistemi (soprattutto gli orari) e invii tu con un click.

Copre le tre risposte che scrivi sempre:

| Pulsante | Quando | Cosa scrive |
|---|---|---|
| **Interessato + call** | l'azienda è interessata | ringrazi e proponi tu una call con 2 fasce orarie |
| **Spiega la collaborazione** | ti fanno una domanda ("è curricolare? in presenza? vincolante?") | spieghi che non è stage/tirocinio, non serve consulente del lavoro, è un proseguimento del percorso, e chiudi proponendo una call |
| **Prenoto col vostro link** | l'azienda ti manda un suo link (Calendar/Calendly) | confermi che prenoti tramite il loro link |

Quando apri una mail, il componente **indovina da solo** quale delle tre serve e
la mette per prima (con la ⭐). Tu puoi comunque scegliere qualsiasi pulsante.

## Installazione (una volta sola, ~15 minuti)

Serve fatta da te perché Google richiede che sia il proprietario dell'account a
dare l'ok. Sono clic, niente di tecnico.

1. Vai su **script.google.com** → **Nuovo progetto**.
2. Dai un nome al progetto in alto a sinistra, es. *Suggeritore Bozze*.
3. **Incolla il codice:**
   - Nel file `Codice.gs` che trovi già aperto, cancella tutto e incolla il
     contenuto di **`SuggeritoreBozze.gs`** (questo repository).
4. **Incolla il manifest:**
   - In alto a sinistra icona **ingranaggio → Impostazioni progetto** e spunta
     *«Mostra il file manifest appsscript.json nell'editor»*.
   - Torni all'editor: comparirà il file **`appsscript.json`**. Aprilo, cancella
     tutto e incolla il contenuto di **`appsscript.json`** (questo repository).
5. Salva (icona floppy / `Ctrl+S`).
6. **Prova (Deploy di test):** in alto a destra **Esegui il deployment →
   Prova deployment** → tipo **Componente aggiuntivo di Gmail** → **Installa**.
   Google ti chiede di autorizzare: accetta i permessi (vedi nota sotto).
7. **Apri Gmail** (ricarica la pagina). Sulla barra laterale destra compare
   l'icona del componente. Apri la risposta di un'azienda, clicca l'icona → escono
   i pulsanti.

Fatto. Da qui in poi è sempre lì.

## Come si usa ogni giorno

1. Apri in Gmail la mail dell'azienda a cui vuoi rispondere.
2. Clicca l'icona **Suggeritore Bozze** nella barra a destra.
3. (Facoltativo) scrivi le **fasce orarie** nel campo in alto.
4. Clicca il pulsante consigliato (⭐) o quello che preferisci.
5. In fondo al thread trovi la **bozza**: controlli, sistemi gli orari, invii tu.

## Sui permessi che Google chiede

In fase di autorizzazione Google scrive *«Gestione di bozze e invio di email»*.
È il permesso standard per **creare le bozze**. Il componente **non contiene
nessun codice che invia mail**: crea solo bozze. Puoi verificarlo nel file
`SuggeritoreBozze.gs` (cerca `send`: non c'è).

## Due cose da sapere (piccole)

- **La firma con immagine.** Le bozze create in automatico finiscono con **"MF"**
  ma **non** riportano da sole la tua firma-immagine in calce (Gmail la aggiunge
  solo quando scrivi a mano). Quando apri la bozza per inviarla puoi aggiungerla,
  oppure — se preferisci — posso mettere una firma testuale fissa nel modello.
- **Del "lei".** I testi danno sempre del lei. Se un'azienda ti dà del tu e vuoi
  rispondere a tono, basta che sistemi la bozza prima di inviare.

## Modificare i testi

I tre modelli sono all'inizio di `SuggeritoreBozze.gs`, nella variabile `TESTO`.
Puoi cambiarli quando vuoi: dopo la modifica salva e ricarica Gmail. I segnaposto
`[SALUTO]` e `[SLOT]` vengono riempiti in automatico.
