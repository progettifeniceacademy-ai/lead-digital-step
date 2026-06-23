# Digital Step → ActiveCampaign → Foglio Google

Script per Google Apps Script che ogni 24 ore:

1. legge chi è entrato nello spazio **Digital Step** su Circle;
2. cerca la stessa email su **ActiveCampaign**;
3. se la trova, aggiunge una riga al foglio Google con
   **CheckGiorno | Nome | Cognome | Telefono**.

## Perché prima "mancavano" dei contatti

Lo schema "guarda le ultime 24 ore" lascia dei buchi: se il trigger parte a
un orario leggermente diverso, le persone entrate in quel ritaglio non vengono
mai prese. Questo script usa invece un **segnalibro (watermark)**: salva la data
dell'ultima persona processata e ogni volta recupera *tutto ciò che è entrato
dopo*, anche se un giorno il trigger salta. In più tiene la lista degli ID già
inseriti, quindi **non scrive mai due volte** la stessa persona.

## Configurazione (una volta sola)

1. In Apps Script: **Impostazioni progetto → Proprietà script** e aggiungi:

   | Proprietà | Valore |
   |---|---|
   | `CIRCLE_API_TOKEN` | il token Admin API v1 di Circle |
   | `CIRCLE_SPACE_ID` | `2482783` (spazio Digital Step) |
   | `AC_API_URL` | l'URL del tuo account, es. `https://tuoaccount.api-us1.com` |
   | `AC_API_KEY` | l'Api-Token di ActiveCampaign |
   | `SHEET_ID` | l'ID del foglio Google (sta nell'URL del foglio) |
   | `SHEET_NAME` | il nome della scheda, es. `Foglio1` |

2. Esegui una volta **`testConnessione`** e guarda i log
   (menu **Esecuzioni** / **Visualizza → Log**): devono comparire i totali di
   Circle, ActiveCampaign e il nome del foglio. Se uno dà `ERRORE`, la chiave
   relativa è sbagliata.

## Come verificare che funziona (importante)

- **`test_DryRun`**: simula senza scrivere niente. Nei log vedi esattamente le
  righe che *verrebbero* aggiunte negli ultimi 3 giorni. Qui devono comparire
  i contatti recenti (es. Federico Morra ed Emanuela Ghigliano).
- **`backfill`**: recupera gli arretrati. Eseguila **una volta** per inserire
  davvero chi era stato perso. Di default copre 7 giorni.
  (Per cambiare durata, modifica `backfill(7)` nell'editor o lancia da console.)

## Attivare l'automatismo

Esegui **una volta** `installaTriggerGiornaliero`: crea il trigger che lancia
`aggiornaDigitalStep` ogni giorno verso le 7. Controlla nella barra a sinistra,
icona **Trigger** (sveglia), che il trigger sia presente.

> Suggerimento: dopo qualche giorno apri **Esecuzioni** per controllare che il
> trigger sia partito senza errori. Era proprio questo il punto che prima non
> funzionava: l'esecuzione manuale andava, ma l'automatismo no.

## Funzioni disponibili

| Funzione | A cosa serve |
|---|---|
| `testConnessione` | verifica le chiavi API e l'accesso al foglio |
| `test_DryRun` | simula senza scrivere (per controllare) |
| `backfill` | recupera gli arretrati degli ultimi N giorni |
| `installaTriggerGiornaliero` | attiva l'esecuzione automatica quotidiana |
| `aggiornaDigitalStep` | il lavoro vero (lo chiama il trigger) |
