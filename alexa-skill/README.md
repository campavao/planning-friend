# Planning Friend — Alexa Skill

Read-only Alexa skill that talks to the planning-friend Next.js app. Personal-use, dev-mode, single-user.

## Architecture

```
Echo device → Alexa cloud → AWS Lambda (this dir) → /api/alexa/* on Next.js app → Supabase
```

Auth: long-lived bearer token in Lambda env, matched against `ALEXA_API_TOKEN` on the server. No OAuth / account linking (personal skill, stays in dev mode).

## Current status (milestone 2)

- `TodaysPlanIntent` — working, card shows title + venue on Echo Show
- `WhatsForDinnerIntent` — returns the meal-category plan item for today
- `GetRecipeIntent` — fuzzy-matches by name, reads ingredients + steps with SSML pacing, renders recipe card
- `NextStepIntent` — stub (milestone 4: hands-free step walkthrough with session attributes)
- APL card for Echo Show — not yet (milestone 3, plain Simple card for now)

## One-time setup

### 1. Generate the shared token

```
openssl rand -hex 32
```

### 2. Configure the Next.js app (planning-friend)

Set these env vars on Vercel (Settings → Environment Variables):

| Var | Value |
|---|---|
| `ALEXA_API_TOKEN` | the hex string from step 1 |
| `ALEXA_USER_ID` | your user id (UUID) in the `users` table |

Redeploy so the env changes take effect. Verify with:

```
curl -H "Authorization: Bearer $TOKEN" https://your-app.vercel.app/api/alexa/today
```

You should get a JSON body with `date`, `items`, `speech`.

### 3. Create the Lambda function

1. AWS Console → Lambda → Create function
1. Runtime: **Node.js 20.x**, Architecture: **arm64** (cheaper), Region: matches your Alexa dev account
1. Name: `planning-friend-alexa-skill`
1. Configuration → Environment variables:
   - `PLANNING_FRIEND_API_URL` = `https://your-app.vercel.app`
   - `PLANNING_FRIEND_API_TOKEN` = the same hex string from step 1
1. Configuration → Triggers → Add trigger → Alexa Skills Kit (you'll paste the Skill ID here after step 4)

### 4. Package and upload

```
cd alexa-skill
npm install --omit=dev
zip -r skill.zip index.js package.json node_modules
```

In the Lambda console: Code → Upload from → .zip file → upload `skill.zip`.

Grab the Lambda ARN from the top-right of the function page.

### 5. Create the Alexa skill

1. https://developer.amazon.com/alexa/console/ask → Create Skill
1. Name: Planning Friend, Locale: English (US), Model: Custom, Hosting: Provision your own
1. Interaction Model → JSON Editor → paste `models/en-US.json`, Save, Build Model
1. Endpoint → AWS Lambda ARN → paste the Lambda ARN from step 4 (Default region)
1. Copy the Skill ID, go back to Lambda step 3 and finish adding the ASK trigger with this Skill ID
1. Test tab → enable testing in Development

### 6. Populate the DishName slot

The `DishName` custom slot ships with a placeholder value. For reliable voice matching, paste in your actual recipe titles. The server exposes them as ready-to-paste JSON:

```
curl -H "Authorization: Bearer $TOKEN" https://www.planning-friend.com/api/alexa/dish-slot
```

Response is `{ "count": N, "values": [{ "name": { "value": "..." } }, ...] }`. In the Alexa Console:

1. Build → Slot Types → DishName
1. Delete the placeholder row
1. Click **Bulk Edit** (or the JSON icon) and paste the `values` array
1. Save → Build Model

Re-run after adding recipes. The Lambda also forwards the raw spoken text to the server as a fallback, so a new recipe works on-demand even before you re-sync the slot — it just won't have as strong NLU resolution.

## Daily routine

Alexa app → More → Routines → New:
- When: Schedule → 7:00 AM daily
- Action: Alexa Says → Custom → `Ask planning friend what's on my plan today`

## Local testing

`ask dialog` (ASK CLI) or the Test tab in the developer console. For direct Lambda testing, use a sample `IntentRequest` payload from [the ASK SDK test events](https://github.com/alexa/alexa-skills-kit-sdk-for-nodejs/tree/2.0.x/ask-sdk-test).

## Timezone note

The Lambda asks Alexa for the device's timezone (permission: `alexa::devices:all:settings:read`) and sends today's local date to `/api/alexa/today?date=YYYY-MM-DD`. The Next.js server filters plan items by that date's UTC day window. If the skill is invoked before the permission is granted in the Alexa app, the Lambda falls back to UTC today.

## Files

- `index.js` — Lambda handler, all intents wired
- `models/en-US.json` — interaction model (paste into Alexa Console)
- `skill.json` — skill manifest (reference for `ask-cli` deploy)
- `package.json` — `ask-sdk-core` dependency
- `.env.example` — Lambda env vars

## Next milestones

- M3: APL document for Echo Show visual card (replaces the plain Simple cards)
- M4: `NextStepIntent` with session attributes tracking current step, enabling hands-free cooking flow
