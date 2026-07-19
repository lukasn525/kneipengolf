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

export type Spielform = {
  id: number;
  titel: string;
  beschreibung: string;
  schwierigkeit: number;
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
};

export type Teilnehmer = {
  id: string;
  tour_id: string;
  name: string;
  user_id: string | null;
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
