# Clan Clog Submitter

A browser only test tool for the RuneLite collection log submission API of the [Clan Collection Log Project](https://github.com/KihiraLove/Vardorvis-clan-clog).

Deployed to GitHub Pages

## API request contract

POST /api/v1/runelite/submissions with multipart:
- username: non-empty, max 80 characters
- clanName: non-empty, max 80 characters
- itemId: OSRS game item ID
- worldType: JSON array of world flags
- chatMessage: required text; blank or whitespace input sends `dummy text`
- screenshot: optional PNG, maximum 10 MiB; included by default using the bundled sample screenshot

Headers: Idempotency-Key: UUID and optionally X-Clan-API-Key-Base64: Base64url-encoded (not encrypted) UTF-8 key.

The chat message and screenshot-inclusion setting are saved in a first-party cookie with the other non-secret preferences. The API key is never saved.

**API compatibility:** The currently published backend version on GitHub still requires a screenshot and does not accept chatMessage. This frontend targets the newer API contract when that version becomes available.
