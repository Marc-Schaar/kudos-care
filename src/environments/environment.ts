export const environment = {
  production: true,
  apiUrl: 'http://localhost:8000/api',
  redirectUrl: 'http://localhost:4200',
  clientID: 253674,
  // Zeigt den Dev-Login-Button (POST /api/dev/login/, siehe Backend-CLAUDE.md) — nur
  // hier aktiv, im Produktions-Build (environment.prod.ts) false. Der Endpoint existiert
  // serverseitig ohnehin nur bei Django DEBUG=True, das ist hier nur der UI-Schalter dafür.
  devLoginEnabled: true,
};
