# ONI HUB security operations

## Authorization roles

Firestore and Storage use the Firebase Auth custom claim `oni_role`, not a hard-coded email. Valid roles are `owner`, `admin`, `moderator`, `verified_clan`, and `user`.

Only a trusted server using the Firebase Admin SDK may grant a claim. Example operational action (run in a protected administrator environment, never in browser code):

```js
await admin.auth().setCustomUserClaims(uid, {oni_role: 'admin'});
```

After assigning or changing a role, the user must sign out/in or refresh their ID token. `owner` and `admin` can manage content; `moderator` can review applications/orders and moderate participant records. Browser clients must never set role claims.

## Runtime secrets

`OPENAI_API_KEY` is a Cloudflare Worker secret. It must not be put in `wrangler.toml`, HTML, GitHub Actions variables, or Firebase documents. Set it only with:

```sh
npx wrangler secret put OPENAI_API_KEY
```

Set `ONI_ALLOWED_ORIGINS` per Worker environment to the exact deployed web origins. Production should also use Cloudflare WAF/rate rules and Firebase App Check; the in-memory Worker limit is an instance-local safety control, not a globally distributed quota.

## Deployment order

1. Grant the initial owner/admin custom claim through a trusted Admin SDK environment.
2. Deploy Firestore and Storage rules.
3. Deploy the Worker with its secret and exact allowed origins.
4. Confirm admin login, a valid application/order submission, and blocked invalid submissions in a staging Firebase project before production.

## Known boundary

The current anonymous Meet UX displays room credentials from the public `meets/current` document after a roster match. Firestore Rules cannot grant field-level read access. Preserve this only for the existing public event model; before private events, migrate room credentials to `meetSecrets` and add an authenticated server endpoint that issues short-lived participant access.
