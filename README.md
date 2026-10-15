# Clan Clog Submitter

A browser only test tool for the RuneLite collection log submission API of the [Clan Collection Log Project](https://github.com/KihiraLove/Vardorvis-clan-clog).

Deployed to GitHub Pages

## API request contract

POST /api/v1/runelite/submissions with multipart:
- username: non-empty, max 80 characters
- clanName: non-empty, max 80 characters
- itemId: OSRS game item ID
- worldType: JSON array of world flags
- screenshot: PNG, maximum 10 MiB (a sample picture is attached in the tool)

Headers: Idempotency-Key: UUID and optionally X-Clan-API-Key-Base64: Base64url-encoded (not encrypted) UTF-8 key.
