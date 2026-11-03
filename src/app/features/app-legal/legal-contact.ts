/**
 * Die Angaben, die nur der Betreiber kennt. Impressum und Datenschutzerklärung lesen sie von hier.
 * Solange ein Wert in eckigen Klammern steht, ist die Seite nicht fertig für den Launch.
 */
export const LEGAL_CONTACT = {
  name: '[Vor- und Nachname eintragen]',
  street: '[Straße und Hausnummer eintragen]',
  postalCity: '[PLZ und Ort eintragen]',
  email: '[E-Mail-Adresse eintragen]',
  /** Bei wem der Server steht, z.B. Firma und Land. */
  hostingProvider: '[Hosting-Anbieter und Land eintragen]',
  /** Wie lange der Webserver seine Zugriffsprotokolle aufbewahrt. */
  serverLogRetention: '[Speicherdauer der Server-Protokolle eintragen]',
} as const;
