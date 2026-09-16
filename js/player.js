import {
  db,
  isConfigured,
  ref,
  get,
  set,
  update,
  onValue,
  onDisconnect,
  push,
} from "./firebase-init.js?v=__CACHEBUST__";
import {
  roomRef,
  roomPath,
  randomToken,
  savePlayerSession,
  loadPlayerSession,
  clearPlayerSession,
} from "./room.js?v=__CACHEBUST__";
import { rankEntities } from "./scoring.js?v=__CACHEBUST__";

// ---------------------------------------------------------------------------
// Setup / config check
// ---------------------------------------------------------------------------

if (!isConfigured()) {
  document.getElementById("config-error").classList.remove("hidden");
  throw new Error("Firebase non configurato");
}
document.getElementById("app").classList.remove("hidden");

const el = (id) => document.getElementById(id);

let ROOM_CODE = null;
let PLAYER_ID = null;
let TOKEN = null;
let pendingRoomSnapshot = null;
let roomState = null;
let timerInterval = null;
let lastScreen = null;
let selectedTeamId = null;
let unsubscribeJoinPreview = null;

const SCREENS = ["code", "join", "waiting", "vote", "feedback", "final"];
function showScreen(name) {
  SCREENS.forEach((s) => el(`screen-${s}`).classList.add("hidden"));
  el(`screen-${name}`).classList.remove("hidden");
}

// ---------------------------------------------------------------------------
// Avvio
// ---------------------------------------------------------------------------

async function init() {
  const params = new URLSearchParams(location.search);
  const codeFromUrl = (params.get("code") || "").toUpperCase();
  if (codeFromUrl) el("room-code-input").value = codeFromUrl;

  const saved = loadPlayerSession();
  if (saved) {
    const snap = await get(roomRef(saved.code));
    const val = snap.val();
    if (val && val.players && val.players[saved.playerId]?.token === saved.token) {
      ROOM_CODE = saved.code;
      PLAYER_ID = saved.playerId;
      TOKEN = saved.token;
      await resumeSession();
      return;
    }
    clearPlayerSession();
  }

  showScreen("code");
}

// ---------------------------------------------------------------------------
// STEP 1: codice stanza
// ---------------------------------------------------------------------------

el("room-code-input").addEventListener("input", (e) => {
  e.target.value = e.target.value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 4);
});

el("code-continue-btn").addEventListener("click", async () => {
  const code = el("room-code-input").value.trim().toUpperCase();
  hideError("code-error");
  if (code.length !== 4) {
    showError("code-error", "Il codice deve avere 4 lettere.");
    return;
  }
  const snap = await get(roomRef(code));
  if (!snap.exists()) {
    showError("code-error", "Nessuna stanza trovata con questo codice.");
    return;
  }
  ROOM_CODE = code;
  pendingRoomSnapshot = snap.val();
  enterJoinStep();
});

function enterJoinStep() {
  showScreen("join");
  renderTeamPicker();
  if (unsubscribeJoinPreview) unsubscribeJoinPreview();
  const cb = onValue(roomRef(ROOM_CODE), (snap) => {
    pendingRoomSnapshot = snap.val();
    if (el("screen-join").classList.contains("hidden")) return;
    renderTeamPicker();
  });
  unsubscribeJoinPreview = () => cb && cb();
}

el("back-btn").addEventListener("click", () => {
  if (unsubscribeJoinPreview) unsubscribeJoinPreview();
  showScreen("code");
});

function renderTeamPicker() {
  const settings = pendingRoomSnapshot?.settings || {};
  const wrap = el("team-picker-wrap");
  if (settings.mode !== "teams") {
    wrap.classList.add("hidden");
    return;
  }
  wrap.classList.remove("hidden");

  const entities = pendingRoomSnapshot?.entities || {};
  const teams = Object.entries(entities).filter(([, e]) => e.kind === "team");
  const picker = el("team-picker");
  picker.innerHTML = "";
  teams.forEach(([id, team]) => {
    const label = document.createElement("label");
    label.className = "team-option";
    label.innerHTML = `<span>${team.name}</span>`;
    const radio = document.createElement("input");
    radio.type = "radio";
    radio.name = "team";
    radio.value = id;
    radio.checked = selectedTeamId === id;
    radio.addEventListener("change", () => {
      selectedTeamId = id;
    });
    label.prepend(radio);
    picker.appendChild(label);
  });

  const canCreate =
    settings.teamsMode === "dynamic" && teams.length < (settings.maxTeams || 6);
  el("new-team-wrap").classList.toggle("hidden", !canCreate);
}

el("new-team-btn").addEventListener("click", async () => {
  const name = el("new-team-input").value.trim().slice(0, 20);
  hideError("join-error");
  if (!name) {
    showError("join-error", "Inserisci un nome per la nuova squadra.");
    return;
  }
  const settings = pendingRoomSnapshot?.settings || {};
  const entities = pendingRoomSnapshot?.entities || {};
  const existingTeams = Object.entries(entities).filter(([, e]) => e.kind === "team");
  if (existingTeams.length >= (settings.maxTeams || 6)) {
    showError("join-error", "È stato raggiunto il numero massimo di squadre.");
    return;
  }
  const id = "team_" + teamKeyFromName(name);
  if (!entities[id]) {
    await update(ref(db, roomPath(ROOM_CODE) + "/entities"), {
      [id]: { name, score: 0, kind: "team" },
    });
  }
  selectedTeamId = id;
  el("new-team-input").value = "";
});

function teamKeyFromName(name) {
  return (
    name
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "squadra"
  );
}

// ---------------------------------------------------------------------------
// Invio join
// ---------------------------------------------------------------------------

el("join-btn").addEventListener("click", async () => {
  hideError("join-error");
  const nickname = el("nickname-input").value.trim().slice(0, 20);
  if (!nickname) {
    showError("join-error", "Inserisci un nome.");
    return;
  }

  const roomSnap = await get(roomRef(ROOM_CODE));
  if (!roomSnap.exists()) {
    showError("join-error", "La stanza non esiste più.");
    return;
  }
  const room = roomSnap.val();
  const settings = room.settings || {};
  const players = room.players || {};

  const nameTaken = Object.values(players).some(
    (p) => p.name.toLowerCase() === nickname.toLowerCase()
  );
  if (nameTaken) {
    showError("join-error", "Questo nome è già in uso, scegline un altro.");
    return;
  }

  let entityId;
  if (settings.mode === "teams") {
    if (!selectedTeamId || !(room.entities || {})[selectedTeamId]) {
      showError("join-error", "Scegli o crea una squadra.");
      return;
    }
    entityId = selectedTeamId;
  }

  const playerId = push(ref(db, roomPath(ROOM_CODE) + "/players")).key;
  const token = randomToken();

  if (settings.mode !== "teams") {
    entityId = playerId;
    await set(ref(db, roomPath(ROOM_CODE) + "/entities/" + entityId), {
      name: nickname,
      score: 0,
      kind: "player",
    });
  }

  await set(ref(db, roomPath(ROOM_CODE) + "/players/" + playerId), {
    name: nickname,
    entityId,
    connected: true,
    lastSeen: Date.now(),
    token,
  });

  PLAYER_ID = playerId;
  TOKEN = token;
  savePlayerSession(ROOM_CODE, playerId, token);

  if (unsubscribeJoinPreview) unsubscribeJoinPreview();
  await resumeSession();
});

// ---------------------------------------------------------------------------
// Sessione attiva (join riuscito o ripristinato da localStorage)
// ---------------------------------------------------------------------------

async function resumeSession() {
  const connectedRef = ref(db, roomPath(ROOM_CODE) + "/players/" + PLAYER_ID + "/connected");
  await set(connectedRef, true);
  onDisconnect(connectedRef).set(false);
  await update(ref(db, roomPath(ROOM_CODE) + "/players/" + PLAYER_ID), {
    lastSeen: Date.now(),
  });

  onValue(roomRef(ROOM_CODE), (snap) => {
    if (!snap.exists()) {
      showError("global-error", "La stanza è stata chiusa.");
      return;
    }
    roomState = snap.val();
    render();
  });
}

function myEntityId() {
  return roomState.players?.[PLAYER_ID]?.entityId;
}
function myEntity() {
  const id = myEntityId();
  return id ? roomState.entities?.[id] : null;
}

function render() {
  const entity = myEntity();
  if (entity) {
    el("player-score-chip").textContent = `${entity.score || 0} pt`;
    el("player-score-chip").classList.remove("hidden");
  }

  const status = roomState.status;

  if (status === "lobby") {
    showScreen("waiting");
    el("waiting-subtext").textContent = "In attesa che l'host inizi la partita…";
    lastScreen = "waiting";
    stopTimerLoop();
    return;
  }

  if (status === "round_active") {
    showScreen("vote");
    renderVoteScreen();
    lastScreen = "vote";
    return;
  }

  if (status === "reveal") {
    stopTimerLoop();
    const results =
      (roomState.rounds &&
        roomState.rounds[roomState.currentRoundIndex] &&
        roomState.rounds[roomState.currentRoundIndex].results) ||
      {};
    const myResult = results[myEntityId()];
    if (!myResult) {
      showScreen("waiting");
      el("waiting-subtext").textContent = "Guarda la rivelazione sullo schermo grande!";
      lastScreen = "waiting";
      return;
    }
    showScreen("feedback");
    renderFeedback(myResult, entity);
    lastScreen = "feedback";
    return;
  }

  if (status === "final") {
    stopTimerLoop();
    showScreen("final");
    renderFinalScreen(entity);
    lastScreen = "final";
  }
}

function renderVoteScreen() {
  const roundIdx = roomState.currentRoundIndex;
  const votes = (roomState.rounds?.[roundIdx]?.votes) || {};
  const myVote = votes[myEntityId()];

  el("vote-real-btn").classList.toggle("selected", myVote?.answer === "real");
  el("vote-ai-btn").classList.toggle("selected", myVote?.answer === "ai");
  const statusEl = el("vote-status");
  if (myVote) {
    statusEl.textContent = "✅ Risposta inviata — puoi ancora cambiarla";
    statusEl.classList.add("submitted");
  } else {
    statusEl.textContent = "Scegli una risposta!";
    statusEl.classList.remove("submitted");
  }

  startTimerLoop();
}

function startTimerLoop() {
  stopTimerLoop();
  const tick = () => {
    if (!roomState || roomState.status !== "round_active") {
      stopTimerLoop();
      return;
    }
    const msLeft = roomState.roundEndsAt - Date.now();
    const secLeft = Math.max(0, Math.ceil(msLeft / 1000));
    el("vote-timer").textContent = secLeft;
  };
  tick();
  timerInterval = setInterval(tick, 250);
}
function stopTimerLoop() {
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = null;
}

async function castVote(answer) {
  if (!roomState || roomState.status !== "round_active") return;
  const roundIdx = roomState.currentRoundIndex;
  await set(ref(db, roomPath(ROOM_CODE) + `/rounds/${roundIdx}/votes/${myEntityId()}`), {
    answer,
    answeredAt: Date.now(),
    playerId: PLAYER_ID,
  });
}
el("vote-real-btn").addEventListener("click", () => castVote("real"));
el("vote-ai-btn").addEventListener("click", () => castVote("ai"));

function renderFeedback(result, entity) {
  const box = el("feedback-box");
  box.className = "feedback-screen " + (result.correct ? "correct" : "wrong");
  el("feedback-icon").textContent = result.correct ? "✅" : "❌";
  el("feedback-title").textContent = result.voted
    ? result.correct
      ? "Giusto!"
      : "Sbagliato!"
    : "Tempo scaduto!";
  el("feedback-points").textContent = result.correct
    ? `+${result.points} punti`
    : "+0 punti";
  el("feedback-total-score").textContent = `Totale: ${entity?.score || 0} pt`;
}

function renderFinalScreen(entity) {
  const ranked = rankEntities(roomState.entities);
  const myId = myEntityId();
  const position = ranked.findIndex((e) => e.id === myId) + 1;
  const medals = { 1: "🥇", 2: "🥈", 3: "🥉" };
  el("final-rank").textContent = medals[position] || `#${position}`;
  el("final-summary").textContent = `Hai totalizzato ${entity?.score || 0} punti — ${position}° posto su ${ranked.length}.`;
}

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

function showError(id, msg) {
  el(id).textContent = msg;
  el(id).classList.remove("hidden");
}
function hideError(id) {
  el(id).classList.add("hidden");
}

init().catch((err) => {
  console.error(err);
  showError("global-error", "Errore di connessione a Firebase. Controlla la tua connessione internet.");
});
