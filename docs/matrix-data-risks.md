Matrix Data Strategy – Risks & Assumptions

Assumptions

- Matrix vaults (username + encrypted_password) exist per ixo_profile in USSD DB.
- PIN used in USSD can decrypt matrix password with existing encryption utils.
- A stable homeserver and room-bot service are reachable via MATRIX_HOME_SERVER and MATRIX_BOT_URL.
- User has a dedicated Matrix room keyed by alias derived from their address (generateUserRoomAliasFromAddress).

Risks

- Secrets handling: wrong PIN → decryption failure; stale credentials; rotated passwords.
- Room resolution: room alias may not exist (migrations, older accounts) → need fallback to search by membership or create.
- Access rights: account may not be joined to room or lack permission to view state events → join/permissions flow required.
- API limits: Matrix homeserver rate limiting or downtime.
- Data consistency: room state may be stale vs DB; need reconciliation policies.
- Schema evolution: state event types/keys may change; versioning tags advisable.

Fallbacks & Behavior

- On decryption failure: show DB-based basic Account Details; suggest support contact.
- On room not found: attempt join/create via room-bot if policy allows; otherwise show DB info only.
- On state missing: show placeholders and advise “coming soon”.
- Timeouts: use conservative timeouts; avoid blocking USSD interactions.

Monitoring & Logging

- Log state: login success/failure, alias resolution, state fetch outcomes (without sensitive payloads).
- Metrics: count of successful Matrix reads vs fallbacks; average latency.
- Alerting: error rate spikes from Matrix calls.

Security

- Ensure encryption keys (PIN_ENCRYPTION_KEY) are securely managed.
- Do not log decrypted secrets or full state payloads; redact sensitive fields.
- Consider rotating Matrix credentials and supporting re-encryption flows.

Proposed State Event Schema (initial)

- ixo.room.state.secure/encrypted_mnemonic: { encrypted_mnemonic: string }
- ixo.room.state.profile/account: { name, customer_id, phone_number, email?, household_did? }
- ixo.room.state.contract/details: { contract_id, plan, start_date, end_date, status }
- ixo.room.state.orders/list: Array<{ id, type: "pellets"|"accessories", qty?, created_at, status }>
- ixo.room.state.vouchers/list: Array<{ id, type:"BEAN", amount?, status, metadata_uri? }>

Next Steps

- Implement matrix-reader functions to read these keys with proper fallbacks.
- Add feature flags to enable/disable Matrix reads per-environment.
- Define room-bot endpoints for backfill/migration support if alias missing.
