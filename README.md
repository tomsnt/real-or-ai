# Real or AI 🎮

Un quiz multiplayer in tempo reale, in stile Jackbox: si gioca tutti insieme
in aula, guardando uno **schermo condiviso** (l'host) mentre ogni giocatore
vota da un secondo dispositivo (iPad, telefono, portatile) se l'immagine
mostrata è una **foto reale** o è stata **generata dall'IA**.

È una web app **100% statica** (solo HTML/CSS/JS): nessun server da
installare o avviare sul tuo computer. Basta caricarla su un host statico
gratuito. Per la comunicazione in tempo reale tra i dispositivi usa
**Firebase Realtime Database** (piano gratuito), caricato direttamente nel
browser.

---

## Indice

1. [Come si gioca](#come-si-gioca)
2. [Configurazione Firebase (obbligatoria)](#configurazione-firebase-obbligatoria)
3. [Pubblicare il gioco online](#pubblicare-il-gioco-online)
   - [Strada 1: GitHub Pages](#strada-1--github-pages-consigliata)
   - [Strada 2: Netlify Drop](#strada-2--netlify-drop-zero-account)
4. [Sostituire le immagini](#sostituire-le-immagini)
5. [Struttura del progetto](#struttura-del-progetto)
6. [Regole di sicurezza del database](#regole-di-sicurezza-del-database)
7. [Domande frequenti / problemi comuni](#domande-frequenti--problemi-comuni)

---

## Come si gioca

1. L'insegnante (l'**host**) apre la pagina **`host.html`** sul computer
   collegato al proiettore/TV della classe.
2. Sullo schermo grande compaiono un **codice stanza** di 4 lettere e un
   **QR code**.
3. Gli studenti aprono **`player.html`** dal proprio iPad/telefono (o
   inquadrano il QR code, che li porta lì automaticamente) e inseriscono il
   codice stanza + il proprio nome.
4. L'host sceglie le impostazioni (modalità Individuale o a Squadre, durata
   del round, numero di round) e clicca **"Inizia partita"**.
5. Ad ogni round l'immagine appare **solo sullo schermo grande**. Sui
   dispositivi dei giocatori compaiono solo due grandi pulsanti:
   **"È REALE"** e **"È AI"**.
6. Allo scadere del timer (o quando l'host clicca "Rivela ora"), la
   risposta corretta viene mostrata sullo schermo grande insieme ai punti
   assegnati e alla classifica aggiornata.
7. Dopo l'ultimo round viene mostrato il podio finale. 🏆

Le due modalità:

- **Individuale**: un voto per dispositivo/giocatore, punteggio e
  classifica personali.
- **A Squadre**: gli studenti si dividono in 2-6 squadre (i nomi possono
  essere decisi dall'host oppure creati dagli studenti stessi in fase di
  join), un solo voto conta per ogni squadra ad ogni round.

---

## Configurazione Firebase (obbligatoria)

Il gioco ha bisogno di un piccolo database gratuito su Firebase per far
comunicare i dispositivi in tempo reale. Ci vogliono circa 5 minuti,
**nessuna carta di credito richiesta**.

### 1. Crea un progetto Firebase

1. Vai su **<https://console.firebase.google.com>** e accedi con un
   account Google.
2. Clicca **"Aggiungi progetto"** (o "Add project").
3. Dai un nome al progetto (es. `real-or-ai`) e clicca "Continua".
4. Puoi disattivare Google Analytics (non serve): clicca "Crea progetto".

### 2. Attiva il Realtime Database

1. Nel menu a sinistra, apri **"Build" → "Realtime Database"**.
2. Clicca **"Crea database"**.
3. Scegli una location (va bene quella suggerita, es. Europe).
4. Scegli **"Avvia in modalità test"** (regole aperte per 30 giorni — le
   sistemeremo subito dopo, vedi sotto).

### 3. Crea un'app Web e copia le chiavi

1. Torna alla panoramica del progetto (icona casetta) e clicca
   l'icona **`</>`** ("Aggiungi app" → Web).
2. Dai un nome all'app (es. `real-or-ai-web`) e clicca "Registra app".
   **Non** serve configurare Firebase Hosting.
3. Ti verrà mostrato un blocco di codice `firebaseConfig = { ... }`:
   copia quei valori.
4. Apri il file **`firebase-config.js`** in questo progetto e incolla i
   tuoi valori al posto di quelli di esempio (`INCOLLA_QUI_...`).

Quel file è l'**unico** che devi modificare per far funzionare il gioco.

### 4. Regole di sicurezza (consigliato)

Per un uso didattico in aula, senza login, delle regole aperte sui dati
della stanza vanno benissimo. Vai su **Realtime Database → Regole** e
incolla:

```json
{
  "rules": {
    "rooms": {
      ".read": true,
      ".write": true
    }
  }
}
```

Clicca "Pubblica". Vedi anche la sezione
[Regole di sicurezza del database](#regole-di-sicurezza-del-database) per
un'alternativa leggermente più restrittiva.

---

## Pubblicare il gioco online

Una volta compilato `firebase-config.js`, il gioco è già pronto: basta
metterlo online. Due strade, entrambe gratuite e senza installare nulla sul
tuo computer.

### Strada 1 — GitHub Pages (consigliata)

Il progetto è già stato inizializzato come repository Git con un primo
commit pronto. Tu devi solo collegarlo al tuo account GitHub.

1. **Crea un account GitHub** (se non ce l'hai già): vai su
   <https://github.com/signup> e segui la procedura guidata.
2. **Crea un nuovo repository vuoto**:
   - Vai su <https://github.com/new>.
   - Dagli un nome, ad esempio `real-or-ai`.
   - Lascialo **pubblico**.
   - **Non** selezionare "Aggiungi un file README" (ne abbiamo già uno).
   - Clicca "Crea repository".
3. GitHub ti mostrerà dei comandi sotto "…or push an existing repository
   from the command line". Aprili in un terminale dentro la cartella del
   progetto (`RealOrAI`) e incolla quei comandi, che assomigliano a:

   ```bash
   git remote add origin https://github.com/TUO-UTENTE/real-or-ai.git
   git branch -M main
   git push -u origin main
   ```

   (Sostituisci l'URL con quello mostrato da GitHub per il tuo repository.)

   In alternativa, senza usare il terminale: apri la pagina del repository
   vuoto su GitHub, clicca **"uploading an existing file"** e trascina
   dentro tutti i file e le cartelle di questo progetto.

4. **Attiva GitHub Pages**:
   - Nel repository su GitHub, vai su **Settings → Pages**.
   - Sotto "Build and deployment" → "Source", scegli **"Deploy from a
     branch"**.
   - Come branch scegli **`main`** e cartella **`/ (root)`**, poi
     **Save**.
   - Dopo circa un minuto, GitHub mostrerà l'URL pubblico del sito, del
     tipo:

     ```
     https://TUO-UTENTE.github.io/real-or-ai/
     ```

5. Apri quell'URL seguito da `host.html` sul proiettore, ad esempio:

   ```
   https://TUO-UTENTE.github.io/real-or-ai/host.html
   ```

   e `player.html` sarà l'indirizzo che gli studenti raggiungono tramite
   il QR code generato automaticamente dalla pagina host.

> **Nota tecnica**: tutti i percorsi del progetto (immagini, CSS, script)
> sono **relativi**, quindi funzionano sia in locale sia pubblicati in una
> sottocartella come `TUO-UTENTE.github.io/real-or-ai/`. Non serve alcun
> passaggio di build: la pagina funziona così com'è.

### Strada 2 — Netlify Drop (zero account Git)

Se non vuoi usare Git/GitHub, puoi pubblicare il progetto in pochi secondi:

1. Vai su **<https://app.netlify.com/drop>**.
2. Trascina l'intera cartella del progetto (`RealOrAI`) dentro il riquadro
   della pagina.
3. Netlify carica i file e ti restituisce subito un link pubblico
   condivisibile, del tipo `https://nome-a-caso.netlify.app`.
4. Apri `https://nome-a-caso.netlify.app/host.html` sul proiettore.

Non serve creare un account per la versione "Drop" base (puoi crearne uno
gratuito in seguito se vuoi poter aggiornare lo stesso sito più volte).

---

## Sostituire le immagini

Nel progetto trovi 8 immagini segnaposto colorate in `images/` (etichettate
"FOTO REALE" o "IMMAGINE AI") e il file **`images.json`** che le descrive:

```json
[
  { "file": "placeholder1.svg", "isAI": false, "note": "Nota opzionale mostrata alla rivelazione." },
  { "file": "placeholder5.svg", "isAI": true,  "note": "Spiega perché è generata dall'IA, se vuoi." }
]
```

Per usare le tue immagini:

1. Copia i tuoi file immagine (jpg/png/webp) dentro la cartella `images/`.
2. Modifica `images.json`: per ogni immagine indica `file` (il nome del
   file), `isAI` (`true` se generata dall'IA, `false` se è una foto reale)
   e, se vuoi, una `note` che verrà mostrata durante la rivelazione (utile
   per spiegare agli studenti cosa l'ha tradita, o da dove viene la foto).
3. Puoi aggiungerne quante ne vuoi: l'host mescola automaticamente tutte
   le immagini elencate in `images.json` a inizio partita.
4. Ricorda di caricare anche le nuove immagini quando pubblichi il sito
   (con `git add`/`git push`, oppure ritrascinando la cartella su
   Netlify Drop).

---

## Struttura del progetto

```
RealOrAI/
├── index.html            Pagina di scelta: Host o Giocatore
├── host.html              Schermo condiviso (proiettore/TV)
├── player.html             Pagina giocatore (mobile/iPad)
├── firebase-config.js       ⚠️ L'UNICO file da modificare (chiavi Firebase)
├── images.json               Elenco immagini + risposta corretta
├── images/                    Immagini di gioco (placeholder inclusi)
├── css/
│   ├── common.css             Stili condivisi
│   ├── host.css                Stili schermo host (alto contrasto)
│   └── player.css               Stili schermo giocatore (mobile-first)
├── js/
│   ├── firebase-init.js         Inizializzazione Firebase (App + RTDB)
│   ├── room.js                   Helper stanza: codice, riconnessione, pulizia
│   ├── scoring.js                 Logica punteggio condivisa
│   ├── host.js                     Macchina a stati dell'host
│   └── player.js                    Logica client giocatore
└── README.md
```

---

## Regole di sicurezza del database

Le regole proposte sopra (`".read": true, ".write": true` sotto `rooms`)
sono pensate per un uso didattico in aula: nessun login, massima
semplicità, e chiunque conosca il codice stanza può leggere/scrivere solo
i dati di quella stanza. Le chiavi in `firebase-config.js` sono pubbliche
per natura (sono pensate per girare nel browser di chiunque giochi): va
benissimo che restino nel repository, anche pubblico.

Se in futuro vuoi restringere un po' l'accesso (ad esempio evitare che
qualcuno scriva dati non validi), puoi validare la forma dei dati nelle
regole, ad esempio limitando la lunghezza dei nomi:

```json
{
  "rules": {
    "rooms": {
      "$roomCode": {
        ".read": true,
        ".write": true,
        "players": {
          "$playerId": {
            "name": {
              ".validate": "newData.isString() && newData.val().length <= 20"
            }
          }
        }
      }
    }
  }
}
```

Per una sicurezza più solida (consigliata solo se esponi il gioco al di
fuori di un contesto d'aula controllato) valuta l'autenticazione anonima
di Firebase e regole che leghino la scrittura all'utente autenticato.

---

## Domande frequenti / problemi comuni

**"Configurazione Firebase mancante" sulla pagina.**
Non hai ancora incollato i tuoi valori in `firebase-config.js`, oppure hai
lasciato uno dei placeholder `INCOLLA_QUI_...`.

**Il QR code non compare.**
Il gioco carica la libreria del QR code da un CDN esterno: se sei offline
o la rete della scuola blocca quel dominio, il QR potrebbe non generarsi.
In quel caso usa comunque l'indirizzo testuale mostrato subito sotto nella
pagina host.

**Voglio provare in locale prima di pubblicare.**
Puoi aprire `host.html`/`player.html` direttamente con doppio click in
molti browser, ma per caricare `images.json` alcuni browser richiedono che
i file vengano serviti da un piccolo server locale (non serve installare
nulla: il Mac ha già Python). Dalla cartella del progetto:

```bash
python3 -m http.server 8080
```

e poi apri `http://localhost:8080/host.html`. Questo è solo un comodo
strumento di test: **non è necessario per giocare davvero**, che avviene
sempre tramite l'URL pubblico ottenuto da GitHub Pages o Netlify Drop.

**Le stanze vecchie restano nel database per sempre?**
No: non essendoci un server dietro le quinte, la pulizia è "best effort" —
ogni volta che un host crea una nuova stanza, il client elimina
automaticamente le stanze rimaste inattive da più di 6 ore. Per un uso
scolastico normale (una o poche stanze alla volta) è più che sufficiente.

**Un giocatore ricarica la pagina o perde la connessione: perde i punti?**
No. Il dispositivo salva localmente (localStorage) il codice stanza, il
proprio nome/squadra e un token; alla riapertura della pagina, il
giocatore rientra automaticamente nella stessa posizione con lo stesso
punteggio. Lo stesso vale per l'host: se ricarica `host.html`, la stanza
non viene distrutta e riprende il controllo della partita in corso.

**Buon divertimento in classe! 🎉**
