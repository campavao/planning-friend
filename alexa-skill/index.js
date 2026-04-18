"use strict";

const Alexa = require("ask-sdk-core");

const todayAPL = require("./apl/today.json");
const recipeAPL = require("./apl/recipe.json");
const weekAPL = require("./apl/week.json");

// Escape characters that would break SSML/APL rendering. Alexa wraps
// .speak() output in <speak>...</speak> (so & < > must be entities), AND
// APL Text components parse their content as HTML — a raw "&" in a
// recipe title like "Chicken & Rice" triggers a malformed entity error
// and Alexa rejects the whole response with "there was a problem".
// Apply to any user-provided string that flows into speech OR an APL
// datasource. Card (Simple) content is unaffected.
function escapeSsml(s) {
  if (s == null) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// Recognizes pronouns and vague references that should resolve against
// session context instead of being matched as a recipe name. When Alexa
// captures "that" as the SearchQuery dish slot, we look up the most
// recently mentioned meal from session attributes.
const PRONOUN_DISH = new Set([
  "that",
  "it",
  "this",
  "that one",
  "this one",
  "the one",
  "the meal",
  "the dish",
  "the recipe",
  "tonight's dinner",
  "tonights dinner",
  "my dinner",
  "dinner",
]);

function isPronounDish(value) {
  if (!value) return true;
  return PRONOUN_DISH.has(String(value).toLowerCase().trim());
}

function setLastMeals(handlerInput, meals) {
  const attrs = handlerInput.attributesManager.getSessionAttributes();
  if (meals.length > 0) {
    attrs.lastMeals = meals.map((m) => ({ title: m.title, id: m.id }));
  } else {
    delete attrs.lastMeals;
  }
  handlerInput.attributesManager.setSessionAttributes(attrs);
}

function getLastMealTitle(handlerInput) {
  const attrs = handlerInput.attributesManager.getSessionAttributes();
  const first = attrs.lastMeals?.[0];
  return first ? first.title : null;
}

const API_URL = process.env.PLANNING_FRIEND_API_URL;
const API_TOKEN = process.env.PLANNING_FRIEND_API_TOKEN;

function requireConfig() {
  if (!API_URL || !API_TOKEN) {
    throw new Error(
      "PLANNING_FRIEND_API_URL and PLANNING_FRIEND_API_TOKEN must be set"
    );
  }
}

async function fetchJson(path, params) {
  requireConfig();
  const url = new URL(path, API_URL);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v != null) url.searchParams.set(k, v);
    }
  }
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${API_TOKEN}` },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`API ${res.status}: ${body.slice(0, 200)}`);
  }
  return res.json();
}

async function getDeviceDate(handlerInput) {
  try {
    const deviceId = Alexa.getDeviceId(handlerInput.requestEnvelope);
    const upsClient = handlerInput.serviceClientFactory.getUpsServiceClient();
    const tz = await upsClient.getSystemTimeZone(deviceId);
    if (tz) {
      const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: tz,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).formatToParts(new Date());
      const y = parts.find((p) => p.type === "year").value;
      const m = parts.find((p) => p.type === "month").value;
      const d = parts.find((p) => p.type === "day").value;
      return `${y}-${m}-${d}`;
    }
  } catch (err) {
    console.warn("Falling back to server date:", err.message);
  }
  return new Date().toISOString().slice(0, 10);
}

function supportsAPL(handlerInput) {
  // Only trust device.supportedInterfaces. The simulator advertises a
  // Viewport with type:"APL" but its device cannot actually render APL
  // directives ("The device does not support Alexa.Presentation.APL
  // directives" in the Device Log). Real Echo Shows include APL in
  // supportedInterfaces; audio-only Echos and the simulator fall back
  // to SimpleCard.
  const supported =
    handlerInput.requestEnvelope?.context?.System?.device?.supportedInterfaces;
  return Boolean(supported && supported["Alexa.Presentation.APL"]);
}

// Resolves an AMAZON.DATE slot value into one of:
//   { kind: "date", date: "YYYY-MM-DD" }     specific day
//   { kind: "week", monday: "YYYY-MM-DD" }   ISO week (inc. weekend "-WE")
//   { kind: "none" }                         slot empty
//   { kind: "unsupported", reason }          month/year/season/decade
// See https://developer.amazon.com/docs/custom-skills/slot-type-reference.html#date
function resolveWhen(slotValue) {
  if (!slotValue) return { kind: "none" };
  if (/^\d{4}-\d{2}-\d{2}$/.test(slotValue)) {
    return { kind: "date", date: slotValue };
  }
  const weekMatch = slotValue.match(/^(\d{4})-W(\d{2})(-WE)?$/);
  if (weekMatch) {
    return {
      kind: "week",
      monday: isoWeekToMonday(
        parseInt(weekMatch[1], 10),
        parseInt(weekMatch[2], 10)
      ),
    };
  }
  if (/^\d{4}-\d{2}$/.test(slotValue)) {
    return { kind: "unsupported", reason: "month" };
  }
  if (/^\d{4}$/.test(slotValue)) {
    return { kind: "unsupported", reason: "year" };
  }
  return { kind: "unsupported", reason: "range" };
}

function isoWeekToMonday(year, week) {
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4Day = jan4.getUTCDay() || 7;
  const monday = new Date(jan4);
  monday.setUTCDate(jan4.getUTCDate() - (jan4Day - 1) + (week - 1) * 7);
  return monday.toISOString().slice(0, 10);
}

function daysBetween(a, b) {
  const aMs = Date.parse(a + "T00:00:00.000Z");
  const bMs = Date.parse(b + "T00:00:00.000Z");
  return Math.round((bMs - aMs) / 86_400_000);
}

function addTodayAPL(builder, data, dateLabel) {
  const items = (data.items || []).map((i, idx) => ({
    token: String(idx),
    primaryText: escapeSsml(i.title),
    secondaryText: escapeSsml(i.location || categoryLabel(i.category)),
  }));
  builder.addDirective({
    type: "Alexa.Presentation.APL.RenderDocument",
    token: "today",
    document: todayAPL,
    datasources: {
      today: {
        title: "Your Plan",
        subtitle: escapeSsml(dateLabel),
        items,
      },
    },
  });
}

function addRecipeAPL(builder, data) {
  const subtitleParts = [];
  if (data.ingredients?.length) {
    subtitleParts.push(`${data.ingredients.length} ingredients`);
  }
  if (data.steps?.length) {
    subtitleParts.push(`${data.steps.length} steps`);
  }
  // Pre-format step data as objects so APL doesn't need bind/ordinal —
  // each step has its own ordinal label baked in as a string. Simpler
  // rendering avoids Container layout quirks in APL 2024.3 Sequences.
  const steps = (data.steps || []).map((step, i) => ({
    ordinal: `STEP ${i + 1}`,
    body: escapeSsml(step),
  }));
  const ingredients = (data.ingredients || []).map((ing) => ({
    body: escapeSsml(ing),
  }));
  builder.addDirective({
    type: "Alexa.Presentation.APL.RenderDocument",
    token: "recipe",
    document: recipeAPL,
    datasources: {
      recipe: {
        title: escapeSsml(data.title || "Recipe"),
        subtitle: subtitleParts.join(" · "),
        ingredients,
        steps,
      },
    },
  });
}

function categoryLabel(category) {
  switch (category) {
    case "meal":
      return "Meal";
    case "drink":
      return "Drink";
    case "event":
      return "Event";
    case "date_idea":
      return "Date idea";
    case "travel":
      return "Travel";
    default:
      return "";
  }
}

// Shared rendering for the week view — used by both WeekPlanIntent and
// LaunchRequest so the skill's home screen is the same week dashboard.
// Renders horizontally scrolling day cards on APL devices, otherwise a
// plain text card grouped by day.
function applyWeekToBuilder(builder, handlerInput, data, opts = {}) {
  if (supportsAPL(handlerInput)) {
    const todayIso = opts.todayDate || new Date().toISOString().slice(0, 10);
    const rawDays = data.days || [];
    // Rotate so today is the first card. More useful than starting from
    // Monday — the user always sees "today" first, then the rest of the
    // week in order. Falls back to the server order if today isn't in
    // the payload (e.g. querying a past week).
    const todayIdx = rawDays.findIndex((d) => d.date === todayIso);
    const orderedDays =
      todayIdx > 0
        ? [...rawDays.slice(todayIdx), ...rawDays.slice(0, todayIdx)]
        : rawDays;

    const days = orderedDays.map((day) => ({
      date: day.date,
      dayName: escapeSsml(day.dayName),
      shortDate: formatShortDate(day.date),
      isToday: day.date === todayIso,
      items: (day.items || []).map((item) => ({
        title: escapeSsml(item.title),
        location: item.location ? escapeSsml(item.location) : null,
        sharedBy: item.sharedBy ? escapeSsml(item.sharedBy) : null,
      })),
    }));

    builder.addDirective({
      type: "Alexa.Presentation.APL.RenderDocument",
      token: "week",
      document: weekAPL,
      datasources: {
        week: {
          title: opts.title || "This Week",
          subtitle:
            data.totalItems === 0
              ? "Nothing planned"
              : `${data.totalItems} item${data.totalItems === 1 ? "" : "s"}`,
          days,
        },
      },
    });
  } else {
    const lines = [];
    for (const day of data.days || []) {
      if (!day.items || day.items.length === 0) continue;
      lines.push(`${day.dayName}:`);
      for (const item of day.items) {
        lines.push(
          `  • ${item.title}${item.location ? " — " + item.location : ""}`
        );
      }
    }
    builder.withSimpleCard(
      opts.title || "This Week",
      lines.length > 0 ? lines.join("\n") : "Nothing planned."
    );
  }
}

function formatShortDate(dateIso) {
  if (!dateIso || !/^\d{4}-\d{2}-\d{2}$/.test(dateIso)) return "";
  const d = new Date(dateIso + "T12:00:00Z");
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).toUpperCase();
}

// Extract today's items from the week payload so LaunchRequest can save
// meals to session for pronoun follow-ups and build a short today-focused
// speech summary.
function getTodayBucket(weekData, dateIso) {
  const day = (weekData.days || []).find((d) => d.date === dateIso);
  return day?.items || [];
}

const LaunchRequestHandler = {
  canHandle(handlerInput) {
    return (
      Alexa.getRequestType(handlerInput.requestEnvelope) === "LaunchRequest"
    );
  },
  async handle(handlerInput) {
    try {
      const date = await getDeviceDate(handlerInput);
      // Rolling 7-day window from today — home screen always starts on
      // today and shows the next 6 days, spanning week boundaries.
      const data = await fetchJson("/api/alexa/week", { startDate: date });

      const todayItems = getTodayBucket(data, date);
      const todayTitles = todayItems.map((i) => escapeSsml(i.title));

      let speech = "Welcome to Planning Friend.";
      if (data.totalItems === 0) {
        speech += " You don't have anything planned this week.";
      } else if (todayTitles.length > 0) {
        speech += ` For today: ${joinList(todayTitles)}.`;
      } else {
        const count = data.totalItems === 1 ? "one thing" : `${data.totalItems} things`;
        speech += ` You have ${count} planned this week. Nothing on today.`;
      }

      const builder = handlerInput.responseBuilder.speak(speech);
      applyWeekToBuilder(builder, handlerInput, data, {
        title: "Planning Friend",
        todayDate: date,
      });

      // Save today's meals so "recipe for that" resolves after launch.
      const todayMeals = todayItems.filter((i) => i.category === "meal");
      setLastMeals(handlerInput, todayMeals);

      builder.reprompt(
        todayMeals.length > 0
          ? 'Say "recipe for that" for today\'s meal, or ask about a specific day.'
          : 'Ask about a specific day, or say "what\'s for dinner".'
      );

      return builder.getResponse();
    } catch (err) {
      console.error("LaunchRequest error:", err);
      return handlerInput.responseBuilder
        .speak("Hi! Ask me what's on your plan today, or what's for dinner.")
        .reprompt("Try asking: what's on my plan today?")
        .getResponse();
    }
  },
};

const TodaysPlanIntentHandler = {
  canHandle(handlerInput) {
    return (
      Alexa.getRequestType(handlerInput.requestEnvelope) === "IntentRequest" &&
      Alexa.getIntentName(handlerInput.requestEnvelope) === "TodaysPlanIntent"
    );
  },
  async handle(handlerInput) {
    const slotValue = Alexa.getSlotValue(
      handlerInput.requestEnvelope,
      "when"
    );
    const resolved = resolveWhen(slotValue);

    if (resolved.kind === "week") {
      return handlerInput.responseBuilder
        .speak(
          "For the whole week, ask me what's my plan this week."
        )
        .reprompt("Say: what's my plan this week.")
        .getResponse();
    }
    if (resolved.kind === "unsupported") {
      return handlerInput.responseBuilder
        .speak(
          "I can only check a specific day. Try today, tomorrow, or a day of the week."
        )
        .reprompt("Try: what's on my plan tomorrow.")
        .getResponse();
    }

    try {
      const date =
        resolved.kind === "date"
          ? resolved.date
          : await getDeviceDate(handlerInput);
      const data = await fetchJson("/api/alexa/today", { date });
      const builder = handlerInput.responseBuilder.speak(data.speech);

      if (supportsAPL(handlerInput)) {
        addTodayAPL(builder, data, formatDateLabel(date));
      } else {
        const cardText =
          data.items.length === 0
            ? "Nothing planned."
            : data.items
                .map((i) =>
                  i.location ? `• ${i.title} — ${i.location}` : `• ${i.title}`
                )
                .join("\n");
        builder.withSimpleCard("Your plan", cardText);
      }

      // Save meal items to session so follow-ups like "recipe for that"
      // can resolve without another skill invocation.
      const meals = (data.items || []).filter((i) => i.category === "meal");
      setLastMeals(handlerInput, meals);
      if (meals.length > 0) {
        builder.reprompt(
          'Say "recipe for that" to hear how to make it, or ask about another day.'
        );
      }

      return builder.getResponse();
    } catch (err) {
      console.error("TodaysPlanIntent error:", err);
      return handlerInput.responseBuilder
        .speak(
          "Sorry, I couldn't reach your planner right now. Please try again in a moment."
        )
        .getResponse();
    }
  },
};

const GetRecipeIntentHandler = {
  canHandle(handlerInput) {
    return (
      Alexa.getRequestType(handlerInput.requestEnvelope) === "IntentRequest" &&
      Alexa.getIntentName(handlerInput.requestEnvelope) === "GetRecipeIntent"
    );
  },
  async handle(handlerInput) {
    const spoken = Alexa.getSlotValue(handlerInput.requestEnvelope, "dish");

    // Pronoun resolution: "what's the recipe for that" resolves to the
    // most recently mentioned meal (saved by TodaysPlanIntent or
    // WhatsForDinnerIntent). Falls through to fuzzy match otherwise.
    let effectiveName = spoken;
    if (isPronounDish(spoken)) {
      effectiveName = getLastMealTitle(handlerInput);
      if (!effectiveName) {
        return handlerInput.responseBuilder
          .speak("Which recipe would you like?")
          .reprompt("Say the name of the recipe.")
          .getResponse();
      }
    }

    try {
      const data = await fetchJson("/api/alexa/recipe", {
        name: effectiveName,
      });
      if (!data.found) {
        return handlerInput.responseBuilder
          .speak(
            data.speech ||
              `I couldn't find a recipe called ${escapeSsml(effectiveName)}.`
          )
          .getResponse();
      }

      const builder = handlerInput.responseBuilder.speak(data.speech);

      if (supportsAPL(handlerInput)) {
        addRecipeAPL(builder, data);
      } else {
        const cardParts = [];
        if (data.ingredients && data.ingredients.length) {
          cardParts.push(
            "Ingredients:\n" +
              data.ingredients.map((i) => `• ${i}`).join("\n")
          );
        }
        if (data.steps && data.steps.length) {
          cardParts.push(
            "Steps:\n" +
              data.steps.map((s, i) => `${i + 1}. ${s}`).join("\n")
          );
        }
        builder.withSimpleCard(
          data.title || "Recipe",
          cardParts.join("\n\n") || "No details saved."
        );
      }

      return builder.getResponse();
    } catch (err) {
      console.error("GetRecipeIntent error:", err);
      return handlerInput.responseBuilder
        .speak(
          "Sorry, I couldn't fetch that recipe right now. Please try again."
        )
        .getResponse();
    }
  },
};

const WhatsForDinnerIntentHandler = {
  canHandle(handlerInput) {
    return (
      Alexa.getRequestType(handlerInput.requestEnvelope) === "IntentRequest" &&
      Alexa.getIntentName(handlerInput.requestEnvelope) === "WhatsForDinnerIntent"
    );
  },
  async handle(handlerInput) {
    const slotValue = Alexa.getSlotValue(
      handlerInput.requestEnvelope,
      "when"
    );
    const resolved = resolveWhen(slotValue);

    if (resolved.kind === "week" || resolved.kind === "unsupported") {
      return handlerInput.responseBuilder
        .speak(
          "I can only check dinner for a specific day. Try tonight, tomorrow, or a day of the week."
        )
        .reprompt("Try: what's for dinner tomorrow.")
        .getResponse();
    }

    try {
      const date =
        resolved.kind === "date"
          ? resolved.date
          : await getDeviceDate(handlerInput);
      const data = await fetchJson("/api/alexa/dinner", { date });
      const builder = handlerInput.responseBuilder.speak(data.speech);

      if (supportsAPL(handlerInput) && data.found) {
        builder.addDirective({
          type: "Alexa.Presentation.APL.RenderDocument",
          token: "today",
          document: todayAPL,
          datasources: {
            today: {
              title: "Dinner",
              subtitle: formatDateLabel(date),
              items: [
                {
                  token: "dinner",
                  primaryText: escapeSsml(data.title),
                  secondaryText: "Meal",
                },
              ],
            },
          },
        });
      } else {
        builder.withSimpleCard(
          "Dinner",
          data.found ? data.title || "Nothing planned" : "Nothing planned"
        );
      }

      if (data.found && data.title) {
        setLastMeals(handlerInput, [{ title: data.title, id: data.id }]);
        builder.reprompt(
          'Say "recipe for that" to hear how to make it.'
        );
      } else {
        setLastMeals(handlerInput, []);
      }

      return builder.getResponse();
    } catch (err) {
      console.error("WhatsForDinnerIntent error:", err);
      return handlerInput.responseBuilder
        .speak("Sorry, I couldn't check dinner right now.")
        .getResponse();
    }
  },
};

const WeekPlanIntentHandler = {
  canHandle(handlerInput) {
    return (
      Alexa.getRequestType(handlerInput.requestEnvelope) === "IntentRequest" &&
      Alexa.getIntentName(handlerInput.requestEnvelope) === "WeekPlanIntent"
    );
  },
  async handle(handlerInput) {
    const slotValue = Alexa.getSlotValue(
      handlerInput.requestEnvelope,
      "when"
    );
    const resolved = resolveWhen(slotValue);

    if (resolved.kind === "unsupported") {
      return handlerInput.responseBuilder
        .speak(
          "I can only check a specific week or date. Try: what's my plan this week, or the week of May twentieth."
        )
        .reprompt("Try: what's my plan this week.")
        .getResponse();
    }

    // Backend accepts ?week=YYYY-MM-DD (Monday) or ?date=YYYY-MM-DD
    // (any day within the target week). Default: current week.
    let params;
    if (resolved.kind === "week") {
      params = { week: resolved.monday };
    } else if (resolved.kind === "date") {
      params = { date: resolved.date };
    } else {
      params = { date: await getDeviceDate(handlerInput) };
    }

    try {
      const data = await fetchJson("/api/alexa/week", params);
      const builder = handlerInput.responseBuilder.speak(data.speech);
      const todayDate = await getDeviceDate(handlerInput);
      applyWeekToBuilder(builder, handlerInput, data, { todayDate });
      return builder.getResponse();
    } catch (err) {
      console.error("WeekPlanIntent error:", err);
      return handlerInput.responseBuilder
        .speak("Sorry, I couldn't fetch your week right now.")
        .getResponse();
    }
  },
};

// Starts a hands-free cooking session. Stores the recipe steps in session
// attributes so NextStepIntent can advance through them. Reads the intro +
// ingredients + step 1 immediately, then keeps the session open.
const CookAlongIntentHandler = {
  canHandle(handlerInput) {
    return (
      Alexa.getRequestType(handlerInput.requestEnvelope) === "IntentRequest" &&
      Alexa.getIntentName(handlerInput.requestEnvelope) === "CookAlongIntent"
    );
  },
  async handle(handlerInput) {
    const spoken = Alexa.getSlotValue(handlerInput.requestEnvelope, "dish");

    let effectiveName = spoken;
    if (isPronounDish(spoken)) {
      effectiveName = getLastMealTitle(handlerInput);
      if (!effectiveName) {
        return handlerInput.responseBuilder
          .speak("Which recipe should we cook?")
          .reprompt("Say the name of the recipe.")
          .getResponse();
      }
    }

    try {
      const data = await fetchJson("/api/alexa/recipe", {
        name: effectiveName,
      });
      if (!data.found) {
        return handlerInput.responseBuilder
          .speak(
            data.speech ||
              `I couldn't find a recipe called ${escapeSsml(effectiveName)}.`
          )
          .getResponse();
      }

      const steps = data.steps || [];
      if (steps.length === 0) {
        return handlerInput.responseBuilder
          .speak(
            `${escapeSsml(data.title)} doesn't have any saved steps, so I can't walk you through it.`
          )
          .getResponse();
      }

      const attrs = handlerInput.attributesManager.getSessionAttributes();
      attrs.cooking = {
        title: data.title,
        steps,
        currentStep: 1,
      };
      handlerInput.attributesManager.setSessionAttributes(attrs);

      const safeTitle = escapeSsml(data.title);
      const safeIngredients = (data.ingredients || []).map(escapeSsml);
      const safeFirstStep = escapeSsml(steps[0]);
      const ingredientsLine = safeIngredients.length
        ? `You'll need: ${joinList(safeIngredients)}. <break time="700ms"/>`
        : "";

      const speech =
        `Let's cook ${safeTitle}. ${ingredientsLine}` +
        `Step 1. ${safeFirstStep} <break time="400ms"/> ` +
        `Say "next" when you're ready for the next step.`;

      const builder = handlerInput.responseBuilder
        .speak(speech)
        .reprompt('Say "next" for the next step.');

      if (supportsAPL(handlerInput)) {
        addRecipeAPL(builder, data);
      }

      return builder.getResponse();
    } catch (err) {
      console.error("CookAlongIntent error:", err);
      return handlerInput.responseBuilder
        .speak("Sorry, I couldn't start that recipe right now.")
        .getResponse();
    }
  },
};

// Advances through the cooking session stored in session attributes. If
// no session is active, nudges the user to start one.
const NextStepIntentHandler = {
  canHandle(handlerInput) {
    return (
      Alexa.getRequestType(handlerInput.requestEnvelope) === "IntentRequest" &&
      Alexa.getIntentName(handlerInput.requestEnvelope) === "NextStepIntent"
    );
  },
  handle(handlerInput) {
    const attrs = handlerInput.attributesManager.getSessionAttributes();
    const cooking = attrs.cooking;
    if (!cooking || !Array.isArray(cooking.steps)) {
      return handlerInput.responseBuilder
        .speak(
          'There\'s no recipe in progress. Say "walk me through" followed by a recipe name to start.'
        )
        .reprompt("Say the name of a recipe to cook.")
        .getResponse();
    }

    const idx = cooking.currentStep;
    if (idx >= cooking.steps.length) {
      delete attrs.cooking;
      handlerInput.attributesManager.setSessionAttributes(attrs);
      return handlerInput.responseBuilder
        .speak(
          `That was the last step for ${escapeSsml(cooking.title)}. Enjoy your meal!`
        )
        .getResponse();
    }

    const step = escapeSsml(cooking.steps[idx]);
    const stepNumber = idx + 1;
    cooking.currentStep = idx + 1;
    attrs.cooking = cooking;
    handlerInput.attributesManager.setSessionAttributes(attrs);

    const isLast = cooking.currentStep >= cooking.steps.length;
    const tail = isLast
      ? ' <break time="400ms"/> That\'s the last step. Enjoy!'
      : ' <break time="400ms"/> Say "next" for the next step.';

    return handlerInput.responseBuilder
      .speak(`Step ${stepNumber}. ${step}${tail}`)
      .reprompt('Say "next" for the next step.')
      .getResponse();
  },
};

const HelpIntentHandler = {
  canHandle(handlerInput) {
    return (
      Alexa.getRequestType(handlerInput.requestEnvelope) === "IntentRequest" &&
      Alexa.getIntentName(handlerInput.requestEnvelope) === "AMAZON.HelpIntent"
    );
  },
  handle(handlerInput) {
    return handlerInput.responseBuilder
      .speak(
        'You can ask: what\'s on my plan today, what\'s on my plan tomorrow, what\'s my plan this week, what\'s for dinner, or read me the recipe for something. To cook hands-free, say "walk me through" followed by a recipe name.'
      )
      .reprompt("What would you like to know?")
      .getResponse();
  },
};

const CancelAndStopIntentHandler = {
  canHandle(handlerInput) {
    if (
      Alexa.getRequestType(handlerInput.requestEnvelope) !== "IntentRequest"
    ) {
      return false;
    }
    const name = Alexa.getIntentName(handlerInput.requestEnvelope);
    return name === "AMAZON.CancelIntent" || name === "AMAZON.StopIntent";
  },
  handle(handlerInput) {
    return handlerInput.responseBuilder.speak("Goodbye.").getResponse();
  },
};

const FallbackIntentHandler = {
  canHandle(handlerInput) {
    return (
      Alexa.getRequestType(handlerInput.requestEnvelope) === "IntentRequest" &&
      Alexa.getIntentName(handlerInput.requestEnvelope) ===
        "AMAZON.FallbackIntent"
    );
  },
  handle(handlerInput) {
    return handlerInput.responseBuilder
      .speak("I didn't catch that. Try: what's on my plan today?")
      .reprompt("Try: what's on my plan today?")
      .getResponse();
  },
};

const SessionEndedRequestHandler = {
  canHandle(handlerInput) {
    return (
      Alexa.getRequestType(handlerInput.requestEnvelope) ===
      "SessionEndedRequest"
    );
  },
  handle(handlerInput) {
    return handlerInput.responseBuilder.getResponse();
  },
};

const ErrorHandler = {
  canHandle() {
    return true;
  },
  handle(handlerInput, error) {
    console.error("Unhandled error:", error);
    return handlerInput.responseBuilder
      .speak("Sorry, something went wrong. Please try again.")
      .getResponse();
  },
};

function joinList(items) {
  if (!items || items.length === 0) return "";
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

function formatDateLabel(date) {
  const today = new Date().toISOString().slice(0, 10);
  const delta = daysBetween(today, date);
  if (delta === 0) return "Today";
  if (delta === 1) return "Tomorrow";
  if (delta === -1) return "Yesterday";
  const d = new Date(date + "T12:00:00Z");
  if (delta > 1 && delta < 7) {
    return d.toLocaleDateString("en-US", {
      weekday: "long",
      timeZone: "UTC",
    });
  }
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

exports.handler = Alexa.SkillBuilders.custom()
  .addRequestHandlers(
    LaunchRequestHandler,
    TodaysPlanIntentHandler,
    WeekPlanIntentHandler,
    GetRecipeIntentHandler,
    WhatsForDinnerIntentHandler,
    CookAlongIntentHandler,
    NextStepIntentHandler,
    HelpIntentHandler,
    CancelAndStopIntentHandler,
    FallbackIntentHandler,
    SessionEndedRequestHandler
  )
  .addErrorHandlers(ErrorHandler)
  .withApiClient(new Alexa.DefaultApiClient())
  .lambda();
