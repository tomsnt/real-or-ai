// ============================================================================
// CONFIGURAZIONE FIREBASE — è l'UNICO file che devi modificare per far
// funzionare il gioco con il tuo progetto Firebase personale.
//
// Come ottenere questi valori (spiegato passo passo anche nel README.md):
//   1. Vai su https://console.firebase.google.com e crea un progetto gratuito.
//   2. Nel progetto, vai su "Realtime Database" e crealo (modalità test).
//   3. Vai su Impostazioni progetto (icona ingranaggio) → "Le tue app" →
//      crea una "App web" (</>) → copia l'oggetto di configurazione che ti
//      viene mostrato e incollalo qui sotto, sostituendo i valori di esempio.
//
// Queste chiavi sono pubbliche per natura (sono destinate a stare nel
// codice che gira nel browser di chiunque giochi): non sono un segreto.
// La sicurezza vera si imposta con le "Regole" del Realtime Database
// (vedi README.md, sezione "Regole di sicurezza").
// ============================================================================

export const firebaseConfig = {
  apiKey: "INCOLLA_QUI_LA_TUA_apiKey",
  authDomain: "INCOLLA_QUI_IL_TUO_authDomain",
  databaseURL: "INCOLLA_QUI_IL_TUO_databaseURL", // es: https://TUO-PROGETTO-default-rtdb.europe-west1.firebasedatabase.app
  projectId: "INCOLLA_QUI_IL_TUO_projectId",
  storageBucket: "INCOLLA_QUI_IL_TUO_storageBucket",
  messagingSenderId: "INCOLLA_QUI_IL_TUO_messagingSenderId",
  appId: "INCOLLA_QUI_IL_TUO_appId",
};
