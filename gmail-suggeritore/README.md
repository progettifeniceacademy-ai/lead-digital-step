# Suggeritore Bozze Fenice — versione AI (Gemini)

Apri la mail di un'azienda, clicchi la bustina ✉️ e clicchi **"Scrivi la bozza"**:
l'AI **legge la mail e scrive la risposta** nel tuo stile, come **bozza dentro alla
conversazione**. La rileggi, la modifichi e la invii **tu** — il componente non
invia mai niente.

Se la mail è fuori dai casi che conosce, **non inventa**: ti scrive *"Non ho una
risposta pronta"*, così rispondi a mano.

Il "cervello" (cosa sa e come scrive: solo remoto, niente stage/tirocini, proponi
call su Meet, chiedi il telefono, del lei, firma MF, ecc.) è nel testo `ISTRUZIONI`
all'inizio di `SuggeritoreBozze.gs`. Si può modificare quando vuoi.

## Cosa serve: una chiave Gemini (gratuita)

1. Vai su **aistudio.google.com/apikey** (accedi con lo stesso account Google).
2. Clicca **"Create API key"** / "Crea chiave API".
3. Copia la chiave (una stringa lunga tipo `AIza...`).

È gratis: per questo volume di mail resti dentro il piano gratuito.

## Installazione / aggiornamento

1. Su **script.google.com** apri il progetto **Suggeritore Bozze**.
2. **`Codice.gs`**: cancella tutto e incolla `SuggeritoreBozze.gs`.
3. **`appsscript.json`**: cancella tutto e incolla `appsscript.json`.
4. **Incolla la chiave**: ingranaggio ⚙️ **Impostazioni progetto → Proprietà script
   → Aggiungi proprietà**:
   - Proprietà: `GEMINI_API_KEY`
   - Valore: la chiave copiata da AI Studio
   - Salva.
5. Torna all'editor, salva (💾).
6. **Esegui il deployment → Verifica deployment**. Se già installato: **Disinstalla**
   e poi **Installa** (i permessi sono cambiati) → **Fine**.
7. Ricarica Gmail. Al primo uso ti chiede di **autorizzare** (Avanzate → Consenti).

## Come si usa

1. **Apri** la mail dell'azienda (aprila, non serve cliccare Rispondi).
2. Clicca la **bustina ✉️** nella barra a destra.
3. Clicca **"✍️ Scrivi la bozza di risposta"**.
4. In fondo alla conversazione compare la **bozza** già scritta: rileggi, sistema, invia tu.

> Un solo pulsante "Scrivi la bozza" (non parte da solo) così non consuma
> generazioni sulle mail che stai soltanto leggendo. Se preferisci che parta
> automaticamente al clic sulla bustina, si può cambiare.

## Permessi richiesti

- Leggere la mail aperta, creare una bozza, contattare Gemini. **Non invia mai email.**

## Costi

Gemini ha un piano gratuito ampio; per il tuo volume il costo è **0**. Se un giorno
il volume crescesse molto, si può passare a un piano a consumo (pochi centesimi).

## Se qualcosa non va

- *"Manca la chiave"* → aggiungi `GEMINI_API_KEY` nelle Proprietà script (punto 4).
- *"Errore tecnico / HTTP 400/404 modello"* → nel file cambia `MODELLO` da
  `gemini-2.0-flash` a `gemini-1.5-flash`, salva, ricarica.
- *"Non ho una risposta pronta"* su una mail che invece è normale → segnalamela,
  aggiorno le `ISTRUZIONI`.
