// Inizializzazione Firebase (App + Realtime Database) via CDN ESM.
// Nessuna installazione richiesta: tutto viene caricato dal browser.

import { firebaseConfig } from "../firebase-config.js?v=__CACHEBUST__";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-app.js";
import {
  getDatabase,
  ref,
  get,
  set,
  update,
  remove,
  push,
  child,
  onValue,
  off,
  onDisconnect,
  serverTimestamp,
  runTransaction,
} from "https://www.gstatic.com/firebasejs/10.13.1/firebase-database.js";

function isConfigured() {
  return (
    firebaseConfig &&
    firebaseConfig.apiKey &&
    !firebaseConfig.apiKey.startsWith("INCOLLA_QUI") &&
    firebaseConfig.databaseURL &&
    !firebaseConfig.databaseURL.startsWith("INCOLLA_QUI")
  );
}

let app = null;
let db = null;

if (isConfigured()) {
  app = initializeApp(firebaseConfig);
  db = getDatabase(app);
}

export {
  db,
  isConfigured,
  ref,
  get,
  set,
  update,
  remove,
  push,
  child,
  onValue,
  off,
  onDisconnect,
  serverTimestamp,
  runTransaction,
};
