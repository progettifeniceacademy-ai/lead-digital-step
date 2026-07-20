# Moderatore AI per la community di Fenice Academy

Sistema per far **gestire da un agente AI** una community su Circle: dà il
benvenuto ai nuovi, risponde alle domande, stimola la conversazione e modera —
con le azioni delicate che passano dalla tua approvazione (modalità **ibrida**).

## Perché così (e non con un "bot che apre il browser")

L'idea iniziale era un agente che entra su Circle da browser fingendosi un utente.
È la strada peggiore: fragile (si rompe a ogni aggiornamento di Circle), lenta e a
rischio blocco account.

Qui invece l'agente parla con Circle tramite la sua **API ufficiale** (la stessa
che già usano gli script in `apps-script/`), attraverso un connettore già
collegato. Più stabile, più veloce, nessun browser. L'"intelligenza" è l'agente
stesso, schedulato per entrare 2-3 volte al giorno.

## Componenti

| File | Cos'è |
|---|---|
| `playbook.md` | Il "cervello": identità, tono, compiti, guardrail, livelli di autonomia, esempi. **È qui che si istruisce il bot.** |
| `faq.md` | Knowledge base: le risposte ufficiali che il bot può dare in autonomia. Da compilare insieme. |
| `run-prompt.md` | Il prompt operativo che la Routine schedulata esegue a ogni giro. |
| `README.md` | Questo file: architettura e messa in opera. |

## Come funziona un giro (2-3 volte al giorno)

```
Routine schedulata  ──►  Agente AI  ──►  API Circle
                          │
                          ├─ legge post/commenti/nuovi membri dall'ultimo giro (watermark)
                          ├─ 🟢 VERDE  → agisce da solo (benvenuto, risposte da FAQ, rilanci, like)
                          ├─ 🟡/🔴      → prepara BOZZA e la manda in approvazione
                          └─ ti invia un report + la lista "da approvare"
```

- **Watermark:** come negli script esistenti, salva l'ultimo elemento processato
  così non rilegge né risponde due volte (niente doppioni anche se un giro salta).
- **Approvazione:** le azioni gialle/rosse non vengono pubblicate finché non
  rispondi "ok".

## Cosa serve per andare live (decisioni aperte)

1. **Lo spazio community → INFO UTILI** (ID `2499840`, gruppo "Parti da qui!").
   Non serve crearne uno nuovo. Lo spazio è **già pubblico** (non privato, non
   nascosto). Unica modifica: **abilitare i post dei membri** (oggi
   `is_post_disabled: true` → i membri possono solo leggere). Il video di benvenuto
   resta pinnato in cima; i post dei membri gli vanno sotto.
2. **L'account del bot → "Guido".** Si usa un'**email già esistente** (es.
   `tutor@feniceacademysrl.com`, da confermare) con **nome visualizzato "Guido"**
   e ruolo di **moderatore** su INFO UTILI.
   - **Autore dei contenuti:** i *post* si possono pubblicare a nome di un membro
     (parametro `user_email`). I *commenti*, con il connettore attuale, **non**
     hanno un campo autore: verrebbero attribuiti all'account con cui è collegato
     il connettore. Poiché un moderatore risponde soprattutto via commenti, la
     soluzione pulita è **collegare il connettore Circle usando il token
     dell'account Guido** (Admin API), così ogni azione risulta di Guido.
3. **La FAQ minima.** Bastano 5-6 risposte in `faq.md` per partire; il resto si
   aggiunge vivendo la community.
4. **La schedulazione.** Routine 1 volta al giorno in avvio (poi eventualmente 2-3).
   ⚠️ **Attenzione connettore:** una Routine creata via API può partire **senza**
   il connettore Circle collegato → la sessione schedulata non riuscirebbe a
   leggere Circle. Soluzioni:
   - **On-demand:** scrivere "Guido, fai il giro" nella sessione, che gira dal vivo
     con il connettore attivo (affidabile, ideale in rodaggio a basso traffico).
   - **Automazione affidabile:** creare la Routine dalla **UI "Routines" di
     claude.ai**, dove si può agganciare il connettore Circle alla Routine.

## Fasi consigliate (community mai testata)

- **Fase 0 — Rodaggio (1-2 settimane):** il bot lavora in modalità **"tutto in
  bozza"**: ti propone ogni intervento, tu approvi. Serve a calibrare tono e FAQ
  su casi reali, a costo zero di rischio.
- **Fase 1 — Ibrido:** una volta tarato, passa alle azioni VERDI in autonomia e
  tiene giallo/rosso in approvazione (la configurazione descritta qui).
- **Fase 2 — Ottimizzazione:** si allarga la FAQ, si affina il playbook con gli
  esempi reali, si valuta se allargare la fascia VERDE.

## Nota sulla trasparenza

Il profilo del bot dichiara di essere un assistente automatico del team Fenice
(vedi `playbook.md` §1): protegge la fiducia della community ed è in linea con le
norme UE su AI e persone.
