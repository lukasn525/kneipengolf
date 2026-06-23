// Spiellogik
// ──────────────────────────────────────────────────────────────

// Zieht beim ersten Betreten einer Kneipe genau einmal eine Spielform
// und merkt sie. Wiederholtes Öffnen würfelt NICHT neu.
export function spielformFuer(kneipeId, vorhandenerStand, spielformen) {
  const bereits = vorhandenerStand[kneipeId];
  if (bereits && bereits.spielformId) {
    return spielformen.find(s => s.id === bereits.spielformId) || null;
  }
  const zufall = spielformen[Math.floor(Math.random() * spielformen.length)];
  return zufall;
}

// Punktestand: weniger Schlücke = besser.
export function tourStatistik(stand) {
  const eintraege = Object.values(stand);
  const erledigt = eintraege.filter(e => e.erledigt);
  const schluckeGesamt = erledigt.reduce((s, e) => s + (e.schlucke || 0), 0);
  return {
    erledigtAnzahl: erledigt.length,
    schluckeGesamt,
    schnitt: erledigt.length ? (schluckeGesamt / erledigt.length).toFixed(1) : "0",
  };
}
