Matrix Integration – Env & Config

Required env variables (USSD)

- MATRIX_HOME_SERVER: base URL for Matrix homeserver (e.g., https://matrix.emerging.eco)
- MATRIX_BOT_URL: URL for room-bot service used for room creation/management (e.g., https://matrix-bot.emerging.eco)
- LOG_LEVEL: inherited from app

Optional/test variables

- MATRIX_LOCAL (boolean): if set, treat MATRIX_HOME_SERVER as already-resolved; skip .well-known
- MATRIX_DEBUG (boolean): increase logging

Recommended dev/test defaults

- MATRIX_HOME_SERVER=https://devnet-matrix.ixo.earth
- MATRIX_BOT_URL=https://devnet-room-bot.ixo.earth
- LOG_LEVEL=debug

Notes

- The existing services/ixo/matrix.ts and services/ixo/matrix-storage.ts already expect MATRIX_BOT_URL and MATRIX_HOME_SERVER via process.env.
- For tests, use a separate .env.test with non-production URLs.
- When running vitest, ensure DATABASE_URL, LOG_LEVEL, PIN_ENCRYPTION_KEY are also set (see src/config.ts).
