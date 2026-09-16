import {
  db,
  isConfigured,
  ref,
  get,
  set,
  update,
  onValue,
  onDisconnect,
} from "./firebase-init.js?v=__CACHEBUST__";
import {
  roomRef,
  roomPath,
  generateUniqueRoomCode,
  cleanupInactiveRooms,
  randomToken,
  saveHostSession,
  loadHostSession,
} from "./room.js?v=__CACHEBUST__";
import { computePoints, rankEntities } from "./scoring.js?v=__CACHEBUST__";

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
let HOST_TOKEN = null;
let IMAGES = [];
let roomState = null; // ultimo snapshot completo della stanza
let timerInterval = null;
let lastRenderedStatus = null;

// ---------------------------------------------------------------------------
// Scoperta contenuti: images/manifest.json elenca tutto quello che c'è
// davvero dentro images/real/ e images/fake/ (qualsiasi nome di file).
// Viene rigenerato automaticamente ad ogni pubblicazione da
// .github/workflows/deploy.yml (script: scripts/generate-manifest.js):
// tu ti limiti a copiare i file nelle due cartelle e a fare push.
// ---------------------------------------------------------------------------

async function loadAllMedia() {
  const res = await fetch("images/manifest.json", { cache: "no-store" });
  if (!res.ok) return [];
  return res.json();
}

// ---------------------------------------------------------------------------
// Avvio: crea una nuova stanza oppure riprende quella salvata in localStorage
// ---------------------------------------------------------------------------

async function init() {
  el("topbar-status").textContent = "Carico i contenuti…";
  IMAGES = await loadAllMedia();

  const saved = loadHostSession();
  if (saved) {
    const snap = await get(roomRef(saved.code));
    if (snap.exists() && snap.val().meta?.hostToken === saved.hostToken) {
      ROOM_CODE = saved.code;
      HOST_TOKEN = saved.hostToken;
      await claimHost();
      attachRoomListener();
      return;
    }
  }

  await createNewRoom();
  attachRoomListener();
}

async function createNewRoom() {
  await cleanupInactiveRooms();
  const code = await generateUniqueRoomCode();
  const token = randomToken();
  const initialRoom = {
    meta: {
      createdAt: Date.now(),
      lastActivity: Date.now(),
      hostToken: token,
      hostConnected: true,
    },
    settings: defaultSettings(),
    status: "lobby",
    currentRoundIndex: -1,
    imageOrder: [],
    roundEndsAt: null,
    players: {},
    entities: {},
    rounds: {},
  };
  await set(roomRef(code), initialRoom);
  ROOM_CODE = code;
  HOST_TOKEN = token;
  saveHostSession(code, token);
  await claimHost();
}

async function claimHost() {
  const connectedRef = ref(db, roomPath(ROOM_CODE) + "/meta/hostConnected");
  await set(connectedRef, true);
  onDisconnect(connectedRef).set(false);
  await touchActivity();
}

async function touchActivity() {
  await update(ref(db, roomPath(ROOM_CODE) + "/meta"), {
    lastActivity: Date.now(),
  });
}

function defaultSettings() {
  return {
    mode: "individual",
    teamsMode: "fixed",
    maxTeams: 4,
    teamNames: [],
    roundDurationSec: 20,
    roundCountMode: "all",
    roundCount: 8,
  };
}

// ---------------------------------------------------------------------------
// Listener principale sullo stato della stanza
// ---------------------------------------------------------------------------

function attachRoomListener() {
  onValue(roomRef(ROOM_CODE), (snap) => {
    if (!snap.exists()) return;
    roomState = snap.val();
    render();
  });
}

function render() {
  el("topbar-code").textContent = ROOM_CODE;
  el("topbar-code").classList.remove("hidden");
  el("topbar-status").textContent = statusLabel(roomState.status);

  if (roomState.status !== lastRenderedStatus) {
    lastRenderedStatus = roomState.status;
    showScreen(roomState.status);
  }

  if (roomState.status === "lobby") renderLobby();
  if (roomState.status === "round_active") renderRoundActive();
  if (roomState.status === "reveal") renderReveal();
  if (roomState.status === "final") renderFinal();
}

function statusLabel(status) {
  return (
    {
      lobby: "In lobby",
      round_active: "Round in corso",
      reveal: "Rivelazione",
      final: "Partita finita",
    }[status] || status
  );
}

function showScreen(status) {
  ["lobby", "round", "reveal", "final"].forEach((s) => {
    el(`screen-${s}`).classList.add("hidden");
  });
  const map = {
    lobby: "screen-lobby",
    round_active: "screen-round",
    reveal: "screen-reveal",
    final: "screen-final",
  };
  el(map[status]).classList.remove("hidden");
}

// ---------------------------------------------------------------------------
// LOBBY
// ---------------------------------------------------------------------------

let qrRendered = false;

function renderLobby() {
  const joinUrl = `${location.origin}${location.pathname.replace(
    /host\.html$/,
    ""
  )}player.html?code=${ROOM_CODE}`;

  el("lobby-room-code").textContent = ROOM_CODE;
  el("lobby-join-url").textContent = joinUrl;

  if (!qrRendered) {
    try {
      // eslint-disable-next-line no-undef
      new QRCode(el("qrcode-container"), {
        text: joinUrl,
        width: 220,
        height: 220,
      });
    } catch (err) {
      console.warn("QR non disponibile:", err);
    }
    qrRendered = true;
  }

  const settings = roomState.settings;
  syncSettingsUI(settings);

  const players = roomState.players || {};
  const entities = roomState.entities || {};
  const rosterEl = el("roster-list");
  rosterEl.innerHTML = "";

  if (settings.mode === "individual") {
    const list = Object.values(players);
    if (!list.length) {
      rosterEl.innerHTML = '<span class="badge">Nessuno ancora…</span>';
    } else {
      list.forEach((p) => {
        const chip = document.createElement("span");
        chip.className = "roster-chip";
        chip.textContent = p.name;
        rosterEl.appendChild(chip);
      });
    }
  } else {
    const teams = Object.entries(entities).filter(([, e]) => e.kind === "team");
    if (!teams.length) {
      rosterEl.innerHTML = '<span class="badge">Nessuna squadra ancora…</span>';
    } else {
      teams.forEach(([teamId, team]) => {
        const membersCount = Object.values(players).filter(
          (p) => p.entityId === teamId
        ).length;
        const chip = document.createElement("span");
        chip.className = "roster-chip team";
        chip.innerHTML = `${team.name} <small>${membersCount} giocatori</small>`;
        rosterEl.appendChild(chip);
      });
    }
  }
}

function syncSettingsUI(settings) {
  el("mode-individual").classList.toggle("active", settings.mode === "individual");
  el("mode-teams").classList.toggle("active", settings.mode === "teams");
  el("teams-config").classList.toggle("hidden", settings.mode !== "teams");

  el("teams-fixed").classList.toggle("active", settings.teamsMode === "fixed");
  el("teams-dynamic").classList.toggle("active", settings.teamsMode === "dynamic");
  el("fixed-team-names-wrap").classList.toggle(
    "hidden",
    settings.teamsMode !== "fixed"
  );

  if (document.activeElement !== el("max-teams")) {
    el("max-teams").value = settings.maxTeams;
  }
  if (document.activeElement !== el("round-duration")) {
    el("round-duration").value = settings.roundDurationSec;
  }
  el("round-count-mode").value = settings.roundCountMode;
  el("round-count-fixed-wrap").classList.toggle(
    "hidden",
    settings.roundCountMode !== "fixed"
  );
  if (document.activeElement !== el("round-count-fixed")) {
    el("round-count-fixed").value = settings.roundCount || 8;
  }
}

async function patchSettings(partial) {
  await update(ref(db, roomPath(ROOM_CODE) + "/settings"), partial);
  await touchActivity();
}

el("mode-individual").addEventListener("click", () =>
  patchSettings({ mode: "individual" })
);
el("mode-teams").addEventListener("click", () => patchSettings({ mode: "teams" }));
el("teams-fixed").addEventListener("click", () => patchSettings({ teamsMode: "fixed" }));
el("teams-dynamic").addEventListener("click", () =>
  patchSettings({ teamsMode: "dynamic" })
);
el("max-teams").addEventListener("change", (e) => {
  const v = Math.max(2, Math.min(6, parseInt(e.target.value, 10) || 4));
  e.target.value = v;
  patchSettings({ maxTeams: v });
});
el("round-duration").addEventListener("change", (e) => {
  const v = Math.max(5, Math.min(120, parseInt(e.target.value, 10) || 20));
  e.target.value = v;
  patchSettings({ roundDurationSec: v });
});
el("round-count-mode").addEventListener("change", (e) => {
  patchSettings({ roundCountMode: e.target.value });
});
el("round-count-fixed").addEventListener("change", (e) => {
  const v = Math.max(1, Math.min(50, parseInt(e.target.value, 10) || 8));
  e.target.value = v;
  patchSettings({ roundCount: v });
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

el("save-team-names").addEventListener("click", async () => {
  const raw = el("fixed-team-names").value;
  const names = raw
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 6);

  if (names.length < 2) {
    showLobbyError("Inserisci almeno 2 nomi di squadra.");
    return;
  }
  clearLobbyError();

  const updates = {};
  names.forEach((name) => {
    const id = "team_" + teamKeyFromName(name);
    updates[`entities/${id}`] = { name, score: 0, kind: "team" };
  });
  updates["settings/teamNames"] = names;
  updates["settings/maxTeams"] = Math.max(names.length, 2);

  await update(ref(db, roomPath(ROOM_CODE)), updates);
  await touchActivity();
});

function showLobbyError(msg) {
  el("lobby-error").textContent = msg;
  el("lobby-error").classList.remove("hidden");
}
function clearLobbyError() {
  el("lobby-error").classList.add("hidden");
}

el("start-game-btn").addEventListener("click", async () => {
  clearLobbyError();
  const settings = roomState.settings;

  if (IMAGES.length === 0) {
    showLobbyError(
      "Nessuna foto/video trovato in images/real/ o images/fake/. Aggiungi almeno una foto reale e una AI, numerate a partire da 1 (vedi README.md)."
    );
    return;
  }

  if (settings.mode === "teams") {
    const teamCount = Object.values(roomState.entities || {}).filter(
      (e) => e.kind === "team"
    ).length;
    if (teamCount < 2) {
      showLobbyError(
        "Servono almeno 2 squadre prima di iniziare (definiscile o fai entrare i giocatori)."
      );
      return;
    }
  } else {
    const playerCount = Object.keys(roomState.players || {}).length;
    if (playerCount < 1) {
      showLobbyError("Aspetta che almeno un giocatore si unisca prima di iniziare.");
      return;
    }
  }

  await startGame();
});

async function startGame() {
  const settings = roomState.settings;
  const indices = IMAGES.map((_, i) => i);
  shuffle(indices);
  const count =
    settings.roundCountMode === "fixed"
      ? Math.min(settings.roundCount, indices.length)
      : indices.length;
  const imageOrder = indices.slice(0, count);

  const durationMs = settings.roundDurationSec * 1000;
  await update(ref(db, roomPath(ROOM_CODE)), {
    imageOrder,
    currentRoundIndex: 0,
    status: "round_active",
    roundEndsAt: Date.now() + durationMs,
    rounds: {},
  });
  await touchActivity();
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

// ---------------------------------------------------------------------------
// ROUND ACTIVE
// ---------------------------------------------------------------------------

function currentImage() {
  const idx = roomState.imageOrder[roomState.currentRoundIndex];
  return IMAGES[idx];
}

// Sostituisce l'elemento <img>/<video> mantenendo lo stesso id, per
// supportare sia foto che clip video nello stesso "palco".
function setStageMedia(id, item) {
  const isVideo = item.type === "video";
  const old = el(id);
  if ((isVideo && old.tagName !== "VIDEO") || (!isVideo && old.tagName !== "IMG")) {
    const next = document.createElement(isVideo ? "video" : "img");
    next.id = id;
    if (isVideo) {
      next.autoplay = true;
      next.loop = true;
      next.muted = true;
      next.playsInline = true;
    } else {
      next.alt = "Immagine del round";
    }
    old.replaceWith(next);
  }
  el(id).src = `images/${item.file}`;
  if (isVideo) el(id).load();
}

function renderRoundActive() {
  const total = roomState.imageOrder.length;
  el("round-label").textContent = `Round ${roomState.currentRoundIndex + 1} di ${total}`;
  el("round-mode-label").textContent =
    roomState.settings.mode === "teams" ? "👥 A Squadre" : "👤 Individuale";

  const img = currentImage();
  setStageMedia("round-image", img);

  const entities = roomState.entities || {};
  const totalEntities = Object.keys(entities).length;
  const votes =
    (roomState.rounds &&
      roomState.rounds[roomState.currentRoundIndex] &&
      roomState.rounds[roomState.currentRoundIndex].votes) ||
    {};
  el("votes-count").textContent = Object.keys(votes).length;
  el("votes-total").textContent = totalEntities;

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
    const timerEl = el("round-timer");
    timerEl.textContent = secLeft;
    timerEl.classList.toggle("low", secLeft <= 5);
    if (msLeft <= 0) {
      stopTimerLoop();
      revealRound();
    }
  };
  tick();
  timerInterval = setInterval(tick, 250);
}

function stopTimerLoop() {
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = null;
}

el("reveal-now-btn").addEventListener("click", () => {
  stopTimerLoop();
  revealRound();
});

async function revealRound() {
  if (!roomState || roomState.status !== "round_active") return;
  const roundIdx = roomState.currentRoundIndex;
  const img = currentImage();
  const durationMs = roomState.settings.roundDurationSec * 1000;
  const roundEndsAt = roomState.roundEndsAt;
  const votes =
    (roomState.rounds && roomState.rounds[roundIdx] && roomState.rounds[roundIdx].votes) ||
    {};
  const entities = roomState.entities || {};

  const updates = {};
  Object.keys(entities).forEach((entityId) => {
    const vote = votes[entityId];
    let correct = false;
    let points = 0;
    if (vote) {
      correct = (vote.answer === "ai") === img.isAI;
      const timeRemaining = Math.max(0, roundEndsAt - (vote.answeredAt || roundEndsAt));
      points = computePoints(correct, timeRemaining, durationMs);
    }
    updates[`rounds/${roundIdx}/results/${entityId}`] = {
      correct,
      points,
      voted: !!vote,
    };
    const currentScore = entities[entityId].score || 0;
    updates[`entities/${entityId}/score`] = currentScore + points;
  });
  updates["status"] = "reveal";

  await update(ref(db, roomPath(ROOM_CODE)), updates);
  await touchActivity();
}

// ---------------------------------------------------------------------------
// REVEAL
// ---------------------------------------------------------------------------

function renderReveal() {
  const total = roomState.imageOrder.length;
  el("reveal-round-label").textContent = `Round ${roomState.currentRoundIndex + 1} di ${total}`;

  const img = currentImage();
  setStageMedia("reveal-image", img);
  const badge = el("reveal-badge");
  badge.textContent = img.isAI ? "IMMAGINE AI" : "FOTO REALE";
  badge.className = "reveal-badge " + (img.isAI ? "ai" : "real");
  el("reveal-note").textContent = img.isAI
    ? "Immagine generata dall'IA."
    : "Immagine reale.";

  const results =
    (roomState.rounds &&
      roomState.rounds[roomState.currentRoundIndex] &&
      roomState.rounds[roomState.currentRoundIndex].results) ||
    {};
  const totalEntities = Object.keys(roomState.entities || {}).length;
  const correctCount = Object.values(results).filter((r) => r.correct).length;
  el("reveal-stats").textContent = `${correctCount}/${totalEntities} hanno indovinato`;

  renderLeaderboard(el("reveal-leaderboard"));

  const total2 = roomState.imageOrder.length;
  el("next-round-btn").textContent =
    roomState.currentRoundIndex + 1 >= total2 ? "Vedi classifica finale 🏆" : "Prossima immagine ▶";
}

function renderLeaderboard(container) {
  const ranked = rankEntities(roomState.entities);
  container.innerHTML = "";
  ranked.forEach((entity, i) => {
    const row = document.createElement("div");
    row.className = `leaderboard-row rank-${i + 1}`;
    row.innerHTML = `<span class="rank">${i + 1}</span><span class="name">${entity.name}</span><span>${entity.score || 0} pt</span>`;
    container.appendChild(row);
  });
}

async function endGameNow() {
  if (!confirm("Terminare la partita adesso e passare alla classifica finale?")) {
    return;
  }
  stopTimerLoop();
  await update(ref(db, roomPath(ROOM_CODE)), { status: "final" });
  await touchActivity();
}

el("end-game-btn-round").addEventListener("click", endGameNow);
el("end-game-btn-reveal").addEventListener("click", endGameNow);

el("next-round-btn").addEventListener("click", async () => {
  const total = roomState.imageOrder.length;
  const nextIdx = roomState.currentRoundIndex + 1;
  if (nextIdx >= total) {
    await update(ref(db, roomPath(ROOM_CODE)), { status: "final" });
  } else {
    const durationMs = roomState.settings.roundDurationSec * 1000;
    await update(ref(db, roomPath(ROOM_CODE)), {
      currentRoundIndex: nextIdx,
      status: "round_active",
      roundEndsAt: Date.now() + durationMs,
    });
  }
  await touchActivity();
});

// ---------------------------------------------------------------------------
// FINAL
// ---------------------------------------------------------------------------

let victoryShownFor = null;

function renderFinal() {
  const ranked = rankEntities(roomState.entities);
  const isTeams = roomState.settings.mode === "teams";

  el("final-victory").classList.toggle("hidden", !isTeams);
  el("final-title").classList.toggle("hidden", isTeams);

  if (isTeams && ranked.length) {
    el("victory-team-name").textContent = ranked[0].name;
    if (victoryShownFor !== ROOM_CODE + roomState.currentRoundIndex) {
      victoryShownFor = ROOM_CODE + roomState.currentRoundIndex;
      spawnConfetti();
    }
  }

  const podium = el("final-podium");
  podium.innerHTML = "";
  const medals = ["🥇", "🥈", "🥉"];
  const classes = ["first", "second", "third"];
  ranked.slice(0, 3).forEach((entity, i) => {
    const step = document.createElement("div");
    step.className = `podium-step ${classes[i]}`;
    step.innerHTML = `<div class="podium-medal">${medals[i]}</div><div>${entity.name}</div><div>${entity.score || 0} pt</div>`;
    podium.appendChild(step);
  });
  renderLeaderboard(el("final-leaderboard"));
}

function spawnConfetti() {
  const field = el("victory-confetti");
  field.innerHTML = "";
  const colors = ["#fbbf24", "#f59e0b", "#38bdf8", "#a78bfa", "#34d399", "#fb7185"];
  for (let i = 0; i < 40; i++) {
    const piece = document.createElement("span");
    piece.className = "confetti-piece";
    piece.style.left = `${Math.random() * 100}%`;
    piece.style.background = colors[i % colors.length];
    piece.style.animationDuration = `${1.2 + Math.random() * 1.2}s`;
    piece.style.animationDelay = `${Math.random() * 0.4}s`;
    field.appendChild(piece);
  }
}

el("new-game-btn").addEventListener("click", async () => {
  victoryShownFor = null;
  const entities = roomState.entities || {};
  const resetEntities = {};
  Object.keys(entities).forEach((id) => {
    resetEntities[id] = { ...entities[id], score: 0 };
  });
  await update(ref(db, roomPath(ROOM_CODE)), {
    status: "lobby",
    currentRoundIndex: -1,
    imageOrder: [],
    roundEndsAt: null,
    rounds: {},
    entities: resetEntities,
  });
  await touchActivity();
});

// ---------------------------------------------------------------------------

init().catch((err) => {
  console.error(err);
  el("connection-banner").textContent =
    "Errore di connessione a Firebase. Controlla firebase-config.js e la connessione internet.";
  el("connection-banner").classList.remove("hidden");
});
