export type Stadt = {
  id: number;
  name: string;
  slug: string;
  lat: number;
  lng: number;
  zoom: number;
};

export type KneipenVorlage = {
  id: number;
  stadt_id: number;
  name: string;
  lat: number;
  lng: number;
  adresse: string | null;
  sortierung: number;
};

export type Sichtbarkeit = "privat" | "oeffentlich";

/** Rolle im Rechte-System. `null` = normale:r Spieler:in. */
export type BenutzerRolle = "admin" | "moderator" | null;

/**
 * Bar (v2.1) – eine Tabelle für alles: kuratierte Bars haben
 * `ersteller_user_id = null`, nutzergenerierte die jeweilige User-ID.
 */
export type Bar = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  adresse: string | null;
  stadt_id: number | null;
  notiz: string | null;
  ersteller_user_id: string | null;
  sichtbarkeit: Sichtbarkeit;
  gesperrt: boolean;
  sortierung: number | null;
  /** 'uebernommen' = aus einer geteilten Route in die eigene Liste kopiert */
  herkunft?: BarHerkunft;
  /** Ursprungsbar der Kopie (weich – wird NULL, wenn das Original verschwindet) */
  quelle_bar_id?: string | null;
  erstellt_am: string;
  geaendert_am: string;
};

/** Woher eine eigene Bar stammt: selbst angelegt oder aus einer Route übernommen. */
export type BarHerkunft = "eigen" | "uebernommen";

/**
 * Route (v2.2) – benannte, geordnete Liste von Stops als Vorlage für Touren.
 * Rechte- und Sichtbarkeitslogik ist identisch zu Bars und Spielformen.
 */
export type Route = {
  id: string;
  name: string;
  beschreibung: string | null;
  stadt_id: number | null;
  ersteller_user_id: string;
  sichtbarkeit: Sichtbarkeit;
  gesperrt: boolean;
  /** Geheimnis im Teilen-Link */
  teilen_token: string;
  /** gesetzt, wenn diese Route aus einem geteilten Link übernommen wurde */
  quelle_route_id: string | null;
  erstellt_am: string;
  geaendert_am: string;
};

/** Ein Stop einer Route: Snapshot (Name/Position) + Referenz auf die Bar. */
export type RoutenStop = {
  id: string;
  route_id: string;
  bar_id: string | null;
  name: string;
  lat: number;
  lng: number;
  adresse: string | null;
  position: number;
};

export type Spielform = {
  id: number;
  titel: string;
  beschreibung: string;
  schwierigkeit: number;
  ersteller_user_id?: string | null;
  sichtbarkeit?: Sichtbarkeit;
  gesperrt?: boolean;
};

export type TourStatus = "lobby" | "laufend" | "beendet";

export type Tour = {
  id: string;
  code: string;
  name: string | null;
  stadt_id: number | null;
  host_user_id: string | null;
  par_schwelle: number;
  strafe_aktiv: boolean;
  strafe_pro_schluck: number;
  verweigerung_strafe: number;
  status: TourStatus;
  glas_typ: GlasTyp;
  spiel_modus: SpielModus;
  /** Route, aus der diese Tour entstanden ist (weich – Snapshot bleibt) */
  route_id?: string | null;
  erstellt_am: string;
};

export type SpielModus = "einzel" | "team";

export type GlasTyp = "bier" | "wein" | "sekt" | "cocktail";

export type TourKneipe = {
  id: string;
  tour_id: string;
  name: string;
  lat: number;
  lng: number;
  adresse: string | null;
  position: number;
  /** Referenz auf die Bar-Bibliothek (Snapshot bleibt maßgeblich) */
  bar_id?: string | null;
};

export type Teilnehmer = {
  id: string;
  tour_id: string;
  name: string;
  user_id: string | null;
  /** Gerät, das diesen Teilnehmer verwaltet (Pass-and-Play) */
  geraet_id?: string | null;
  erstellt_am: string;
};

export type KneipenChallenge = {
  tour_id: string;
  tour_kneipe_id: string;
  spielform_id: number | null;
  titel?: string | null;
  beschreibung?: string | null;
};

/** Dauerhaft am Konto gespeicherte, eigene Kneipe (v2.0). */
export type MeineKneipe = {
  id: string;
  user_id: string;
  name: string;
  lat: number;
  lng: number;
  adresse: string | null;
  erstellt_am: string;
};

/** Dauerhaft am Konto gespeicherte, eigene Spielform (v2.0). */
export type MeineSpielform = {
  id: string;
  user_id: string;
  titel: string;
  beschreibung: string;
  erstellt_am: string;
};

export type Ergebnis = {
  id: string;
  tour_id: string;
  tour_kneipe_id: string;
  teilnehmer_id: string;
  schlucke: number;
  strafschlucke: number;
  erledigt: boolean;
  erledigt_am: string | null;
};
