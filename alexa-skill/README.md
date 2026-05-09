# Planning Friend — Alexa Skill

Read-only Alexa skill that talks to the planning-friend Next.js app. Personal-use, dev-mode, single-user.

## Architecture

```
Echo device → Alexa cloud → AWS Lambda (this dir) → /api/alexa/* on Next.js app → Supabase
```

Auth: long-lived bearer token in Lambda env, matched against `ALEXA_API_TOKEN` on the server. No OAuth / account linking (personal skill, stays in dev mode).

## Current status

- `TodaysPlanIntent` — speaks the plan for today, tomorrow, or any weekday ("what's on my plan tomorrow"). Renders APL list on Echo Show.
- `WeekPlanIntent` — reads a full-week summary grouped by day. Renders APL list with day · location subtitles.
- `WhatsForDinnerIntent` — tonight's or tomorrow's meal-category plan item ("what's for dinner tomorrow"), APL card.
- `GetRecipeIntent` — fuzzy-matches by name, reads ingredients + steps with SSML pacing, APL recipe view.
- `CookAlongIntent` — hands-free cooking mode. Reads intro + ingredients + step 1, stores the rest in session attributes.
- `NextStepIntent` — advances through the active cooking session; ends the session on the final step with "Enjoy your meal!"
- APL — two documents (`apl/today.json`, `apl/recipe.json`), rendered only when the device reports `Alexa.Presentation.APL` support.

## Launch screen

Saying "Alexa, open planning friend" (the bare launch, with no specific intent) loads this week's plan as the home view:

- Speech: "Welcome to Planning Friend. For today: [meals/events]." (or *"You don't have anything planned this week"* when empty)
- APL: full week list on Echo Show — grouped by day with item + location
- Session stays open so you can immediately say *"recipe for that"*, *"walk me through that"*, *"what's on my plan tomorrow"*, etc., without re-invoking the skill.

The default Alexa-branded idle screen no longer appears — you see your plan instead.

## Date queries

`TodaysPlanIntent` and `WhatsForDinnerIntent` take an optional AMAZON.DATE slot. Examples:

- "what's on my plan today" / "tomorrow" / "for Tuesday" / "this saturday"
- "what's the plan on Thursday"
- "what's for dinner tomorrow" / "what's for dinner on Friday"
- "what's my plan this week"

Range queries ("this month", "next year") aren't supported — the skill asks for a specific day. "This week" / "next week" route to `WeekPlanIntent`.

## Shared items

Plan items and recipes shared with you by friends (via planning-friend's share feature) are included transparently:

- `TodaysPlanIntent`, `WhatsForDinnerIntent`, `WeekPlanIntent` merge your own items with anything shared with you for the same date range, ordered chronologically.
- `GetRecipeIntent` / `CookAlongIntent` fuzzy-match across both your own recipe library and recipes someone has shared with you. Shared recipes are introduced in speech: *"Here's Andrea's recipe for Pasta Bolognese."*

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

### 6. Recipe names — no manual sync needed

The recipe intents use the built-in `AMAZON.SearchQuery` slot, which captures whatever the user says without requiring a pre-registered vocabulary. The raw spoken text is forwarded to the server, which fuzzy-matches against your actual recipes (own + shared) at request time. New recipes work the moment you add them in planning-friend — no Alexa Console changes required.

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
- `apl/today.json` — APL document for today's plan / dinner views
- `apl/recipe.json` — APL document for recipe detail view
- `models/en-US.json` — interaction model (paste into Alexa Console)
- `skill.json` — skill manifest (reference for `ask-cli` deploy)
- `package.json` — `ask-sdk-core` dependency
- `.env.example` — Lambda env vars

When zipping for upload, include the `apl/` directory:
```
Compress-Archive -Path index.js,package.json,node_modules,apl -DestinationPath skill.zip -Force
```

## Hands-free cooking flow

Invoke with utterances like "Alexa, ask planning friend to walk me through pasta" (or "cook pasta with me"). The skill:

1. Loads the recipe, stores steps in session attributes
2. Reads: "Let's cook X. You'll need A, B, C. Step 1. [step]. Say 'next' when you're ready."
3. Keeps the Alexa session open — say "next" to advance without re-invoking the skill
4. On the final step, closes out with "Enjoy your meal!"

The session is cleared if you say "stop" or if Alexa times out waiting for a reply.

## Follow-up flow ("what's the recipe for that")

After `TodaysPlanIntent` or `WhatsForDinnerIntent` mentions a meal, the skill stashes it in session attributes and keeps the session open. You can follow up with a pronoun instead of the dish name — all of these work without saying "ask planning friend" again:

- *"Alexa, ask planning friend what's for dinner"* → "Dinner is Garlic Butter Grilled Cheese Dog."
- *"What's the recipe for that?"* → reads the recipe for the saved meal
- *"Walk me through that"* → starts the cook-along flow for the saved meal

Accepted pronouns: `that`, `it`, `this`, `that one`, `this one`, `the one`, `the meal`, `the dish`, `the recipe`, `tonight's dinner`, `my dinner`, `dinner`.

If there are multiple meals on a day, the skill uses the earliest-scheduled one. You can always say the explicit name to override.
