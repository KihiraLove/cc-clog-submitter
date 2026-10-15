# cc-clog-submitter

A browser-only test frontend for the RuneLite collection log submission API used by Vardorvis-clan-clog. Styled with the dark brown and gold palette from BingoPlayerStats.

## Features

- Enter an HTTPS API endpoint or base URL, clan API key, RuneScape username and in-game clan name.
- Search and choose from 1,717 OSRS game item IDs, copied from Vardorvis-clan-clog's catalog/sources/items.json. The submitted ID is a game item ID (not the canonical collection-log database item ID).
- Select F2P or MEMBERS and optionally one of the 14 requested world flags. The frontend sends a JSON array in the multipart worldType field.
- Uploads assets/dummy-submission.png as the screenshot field. This 1920x1080 file is a losslessly optimized, pixel-perfect RGB equivalent of the attachment.
- Random UUIDv4 Idempotency-Key: retained after rejected requests or network errors for retry, regenerated when a field changes, after a success, or using New key.
- Shows the HTTP status and response body.
- Stores the endpoint, username, clan name, selected item, membership, and extra world flag in a 180-day cookie (Secure over HTTPS; SameSite=Strict). No cookie banner or analytics. The clan API key is never saved and lives only in the open tab.

## GitHub Pages

The GitHub Actions workflow validates pull requests and publishes main on push. After merging, set the repository's **Settings → Pages → Build and deployment → Source** to **GitHub Actions**. Once the workflow completes, visit:

https://kihiralove.github.io/cc-clog-submitter/

No npm installation or bundling is required to publish. For local checks, run npm run validate. Serve the static files with a local HTTP server instead of opening index.html as file://, since the browser loads assets using fetch.

## Required CORS configuration on your API

The current Vardorvis-clan-clog Fastify code does not configure cross-origin response headers. Because GitHub Pages and your API have different origins, you **must** configure CORS on the API/reverse proxy before browser requests can work. GitHub Pages cannot bypass this restriction.

The reverse proxy (for example Traefik's Headers middleware) needs to:
- Allow Origin: https://kihiralove.github.io (or your custom Pages domain).
- Allow methods POST and OPTIONS for the RuneLite intake endpoint.
- Allow request headers Content-Type, Idempotency-Key and X-Clan-API-Key-Base64.
- Respond to OPTIONS preflight successfully, and include Access-Control-Allow-Origin on actual success **and error** responses.
- Use HTTPS with a valid certificate for the API; HTTPS Pages cannot access plain HTTP backend endpoints.

Example Traefik labels for an existing middleware (attach the middleware to the same router serving your API, adapting its name to your setup):

    traefik.http.middlewares.clog-cors.headers.accesscontrolalloworiginlist=https://kihiralove.github.io
    traefik.http.middlewares.clog-cors.headers.accesscontrolallowmethods=POST,OPTIONS
    traefik.http.middlewares.clog-cors.headers.accesscontrolallowheaders=Content-Type,Idempotency-Key,X-Clan-API-Key-Base64
    traefik.http.middlewares.clog-cors.headers.accesscontrolmaxage=600
    traefik.http.middlewares.clog-cors.headers.addvaryheader=true

Avoid allowing arbitrary origins for an API requiring a reusable credential.

## API request contract

POST /api/v1/runelite/submissions with multipart:
- username: non-empty, max 80 characters
- clanName: non-empty, max 80 characters
- itemId: OSRS game item ID
- worldType: JSON array of world flags
- screenshot: PNG, maximum 10 MiB (the attached sample is used)

Headers: Idempotency-Key: UUID and optionally X-Clan-API-Key-Base64: Base64url-encoded UTF-8 key. Base64 is encoding, not encryption; only submit credentials to endpoints you trust.

The API deliberately rejects BETA_WORLD, DEADMAN, NOSAVE_MODE, PVP_ARENA, QUEST_SPEEDRUNNING, SEASONAL and TOURNAMENT_WORLD with HTTP 403. This is useful for testing. The API also treats HARDCORE_MAIN as an ordinary world flag; hardcore credit currently requires HC_WORLD_PLACEHOLDER or HC_WORLDS_PLACEHOLDER (not exposed in the requested dropdown).

The backend must have a matching active game item ID and configured clan policy or it can return 403/422. A 201 receipt may be pending rather than approved. The browser cannot distinguish a failed CORS handshake from some network failures, so a failed request retains its idempotency key for replay instead of generating another submission.

See Vardorvis-clan-clog/docs/runelite-submissions.md for the full contract.
