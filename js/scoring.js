// Logica di punteggio condivisa. La modalità "Individuale" è semplicemente
// il caso particolare in cui ogni "entità" che vota è un singolo giocatore:
// tutto il codice di voto/punteggio ragiona in termini di "entità" (entity),
// che sia un player o un'intera squadra.

export const BASE_POINTS = 100;
export const SPEED_BONUS_MAX = 100;

/**
 * Calcola i punti guadagnati per una risposta.
 * @param {boolean} correct - la risposta era corretta?
 * @param {number} timeRemainingMs - tempo rimasto al momento del voto (ms)
 * @param {number} roundDurationMs - durata totale del round (ms)
 */
export function computePoints(correct, timeRemainingMs, roundDurationMs) {
  if (!correct) return 0;
  const frac = Math.max(0, Math.min(1, timeRemainingMs / roundDurationMs));
  return Math.round(BASE_POINTS + SPEED_BONUS_MAX * frac);
}

/** Ordina le entità per punteggio decrescente, con nome come tie-break. */
export function rankEntities(entitiesObj) {
  return Object.entries(entitiesObj || {})
    .map(([id, e]) => ({ id, ...e }))
    .sort((a, b) => (b.score || 0) - (a.score || 0) || a.name.localeCompare(b.name));
}
