# Clan Clog Submitter

A browser only test tool for the RuneLite collection log submission API of the [Clan Collection Log Project](https://github.com/KihiraLove/Vardorvis-clan-clog).

Deployed to GitHub Pages

## API request contract

POST /api/v1/runelite/submissions with multipart:
- username: non-empty, max 80 characters
- clanName: non-empty, max 80 characters
- itemId: OSRS game item ID
- itemName: selected catalogue name (optional in API, provided by tester; max 200 characters)
- worldType: JSON array of world flags
- chatMessage: required text; blank or whitespace input sends `dummy text`
- screenshot: optional PNG, maximum 10 MiB; included by default using the bundled sample screenshot

Headers: Idempotency-Key: UUID and optionally X-Clan-API-Key-Base64: Base64url-encoded (not encrypted) UTF-8 key.

The chat message and screenshot-inclusion setting are saved in a first-party cookie with the other non-secret preferences. The API key is never saved.

The current backend accepts an optional `itemName` and screenshot and requires `chatMessage`. Selecting `HARDCORE_MAIN` marks a hardcore submission. The tester sends the selected catalogue name as `itemName`. The API preserves this as evidence but resolves by game item ID.

## Diagnosing browser network errors

The backend's current source permits browser uploads from `https://kihiralove.github.io` on this RuneLite endpoint. A browser `NetworkError` does not by itself distinguish a client-side error from a certificate, connection, proxy, redirect or CORS problem.

1. Enter the HTTPS server base URL or exact `/api/v1/runelite/submissions` URL. The tester strips trailing slashes. Redirects are deliberately blocked to protect the clan key.
2. In DevTools → Network, inspect the `OPTIONS` request to `/api/v1/runelite/submissions`. It should return **204**, `Access-Control-Allow-Origin: https://kihiralove.github.io`, `Access-Control-Allow-Methods: POST`, and `Access-Control-Allow-Headers` listing `content-type`, `idempotency-key` and `x-clan-api-key-base64`.
3. If `OPTIONS` succeeds, inspect `POST`. Ordinary API rejections (401, 403, 409, 422) are shown in the tester if the response has correct CORS headers. A redirect, intercepted error response, missing CORS header, TLS or connection failure may instead appear as `NetworkError`.

To check the proxy/API preflight without credentials or a submission:

```bash
curl -i -X OPTIONS 'https://clog.example.com/api/v1/runelite/submissions' \
  -H 'Origin: https://kihiralove.github.io' \
  -H 'Access-Control-Request-Method: POST' \
  -H 'Access-Control-Request-Headers: content-type,idempotency-key,x-clan-api-key-base64'
```

The dummy PNG is fetched from Pages before sending the API request. Its failure is now reported separately; the API is not contacted. If a POST might have reached the API but no receipt appeared, retry the identical payload only after checking **Don't regenerate idempotency key**.
