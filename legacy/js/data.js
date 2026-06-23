// Lokale Beispieldaten – identisch zum Inhalt von supabase/schema.sql.
// Werden genutzt, solange Supabase nicht konfiguriert ist, damit die
// App sofort ohne Backend läuft.

export const KNEIPEN = [
  { id: 1, name: "Startpunkt Markt", lat: 50.7344, lng: 7.0989, adresse: "Markt, 53111 Bonn" },
  { id: 2, name: "Alte Schänke",     lat: 50.7368, lng: 7.1006, adresse: "Beispielstr. 1, Bonn" },
  { id: 3, name: "Eckkneipe Süd",    lat: 50.7311, lng: 7.0962, adresse: "Beispielstr. 2, Bonn" },
  { id: 4, name: "Hafenbar",         lat: 50.7402, lng: 7.1051, adresse: "Beispielstr. 3, Bonn" },
  { id: 5, name: "Letzte Runde",     lat: 50.7289, lng: 7.1023, adresse: "Beispielstr. 4, Bonn" },
];

export const SPIELFORMEN = [
  { id: 1,  titel: "Fremde Hand", beschreibung: "Dein Teampartner hält das Glas – du darfst es nicht berühren.", schwierigkeit: 2 },
  { id: 2,  titel: "Karussell",   beschreibung: "Dreh dich beim Trinken langsam einmal im Kreis.", schwierigkeit: 2 },
  { id: 3,  titel: "Linkshänder", beschreibung: "Trink ausschließlich mit der schwächeren Hand.", schwierigkeit: 1 },
  { id: 4,  titel: "Blindflug",   beschreibung: "Augen zu, von Anfang bis Ende.", schwierigkeit: 2 },
  { id: 5,  titel: "Storch",      beschreibung: "Steh dabei auf nur einem Bein.", schwierigkeit: 2 },
  { id: 6,  titel: "Über Kreuz",  beschreibung: "Häng deinen Arm beim Trinken mit dem Partner ein (Hochzeits-Stil).", schwierigkeit: 2 },
  { id: 7,  titel: "Vornehm",     beschreibung: "Der kleine Finger muss die ganze Zeit abstehen.", schwierigkeit: 1 },
  { id: 8,  titel: "Countdown",   beschreibung: "Der Tisch zählt laut mit – trink im Takt.", schwierigkeit: 1 },
  { id: 9,  titel: "Rückwärts",   beschreibung: "Geh beim Trinken rückwärts ein paar Schritte.", schwierigkeit: 3 },
  { id: 10, titel: "Sänger",      beschreibung: "Summe durchgehend eine Melodie, ohne abzusetzen.", schwierigkeit: 3 },
];
