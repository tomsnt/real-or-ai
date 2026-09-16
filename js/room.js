// Funzioni condivise per la gestione delle stanze (usate sia da host.js che
// da player.js): codice stanza, percorsi del database, pulizia stanze
// inattive, helper di localStorage per la riconnessione.

import { db, ref, get, set, remove } from "./firebase-init.js";

export const ROOM_CODE_LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
export const ROOM_INACTIVE_MS = 6 * 60 * 60 * 1000; // 6 ore
export const LS_HOST_KEY = "realOrAi_host";
export const LS_PLAYER_KEY = "realOrAi_player";

export function randomRoomCode() {
  let code = "";
  for (let i = 0; i < 4; i++) {
    code += ROOM_CODE_LETTERS[Math.floor(Math.random() * ROOM_CODE_LETTERS.length)];
  }
  return code;
}

export function roomPath(code) {
  return `rooms/${code}`;
}

export function roomRef(code) {
  return ref(db, roomPath(code));
}

export function randomToken() {
  return (
    Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2)
  );
}

/** Genera un codice stanza a 4 lettere non già in uso. */
export async function generateUniqueRoomCode() {
  for (let attempt = 0; attempt < 25; attempt++) {
    const code = randomRoomCode();
    const snap = await get(roomRef(code));
    if (!snap.exists()) return code;
  }
  throw new Error("Impossibile generare un codice stanza libero, riprova.");
}

/**
 * Best-effort: rimuove le stanze rimaste inattive da troppo tempo.
 * Non essendoci un backend/scheduler, ripuliamo opportunisticamente ogni
 * volta che viene creata una nuova stanza (va benissimo per un uso in aula
 * con poche stanze contemporanee).
 */
export async function cleanupInactiveRooms() {
  try {
    const rootSnap = await get(ref(db, "rooms"));
    if (!rootSnap.exists()) return;
    const now = Date.now();
    const rooms = rootSnap.val();
    const deletions = [];
    for (const code of Object.keys(rooms)) {
      const room = rooms[code];
      const lastActivity = room?.meta?.lastActivity || 0;
      if (now - lastActivity > ROOM_INACTIVE_MS) {
        deletions.push(remove(ref(db, roomPath(code))));
      }
    }
    if (deletions.length) await Promise.allSettled(deletions);
  } catch (err) {
    // Pulizia best-effort: un fallimento qui non deve bloccare il gioco.
    console.warn("Pulizia stanze inattive fallita:", err);
  }
}

export function saveHostSession(code, hostToken) {
  localStorage.setItem(LS_HOST_KEY, JSON.stringify({ code, hostToken }));
}

export function loadHostSession() {
  try {
    return JSON.parse(localStorage.getItem(LS_HOST_KEY) || "null");
  } catch {
    return null;
  }
}

export function clearHostSession() {
  localStorage.removeItem(LS_HOST_KEY);
}

export function savePlayerSession(code, playerId, token) {
  localStorage.setItem(
    LS_PLAYER_KEY,
    JSON.stringify({ code, playerId, token })
  );
}

export function loadPlayerSession() {
  try {
    return JSON.parse(localStorage.getItem(LS_PLAYER_KEY) || "null");
  } catch {
    return null;
  }
}

export function clearPlayerSession() {
  localStorage.removeItem(LS_PLAYER_KEY);
}
