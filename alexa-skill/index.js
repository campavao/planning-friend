"use strict";

const Alexa = require("ask-sdk-core");

const todayAPL = require("./apl/today.json");
const recipeAPL = require("./apl/recipe.json");

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
  const supported =
    handlerInput.requestEnvelope?.context?.System?.device?.supportedInterfaces;
  return Boolean(supported && supported["Alexa.Presentation.APL"]);
}

function addTodayAPL(builder, data, dateLabel) {
  const items = (data.items || []).map((i, idx) => ({
    token: String(idx),
    primaryText: i.title,
    secondaryText: i.location || categoryLabel(i.category),
  }));
  builder.addDirective({
    type: "Alexa.Presentation.APL.RenderDocument",
    token: "today",
    document: todayAPL,
    datasources: {
      today: {
        title: "Your Plan",
        subtitle: dateLabel,
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
  builder.addDirective({
    type: "Alexa.Presentation.APL.RenderDocument",
    token: "recipe",
    document: recipeAPL,
    datasources: {
      recipe: {
        title: data.title || "Recipe",
        subtitle: subtitleParts.join(" · "),
        ingredients: data.ingredients || [],
        steps: data.steps || [],
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

const LaunchRequestHandler = {
  canHandle(handlerInput) {
    return (
      Alexa.getRequestType(handlerInput.requestEnvelope) === "LaunchRequest"
    );
  },
  handle(handlerInput) {
    return handlerInput.responseBuilder
      .speak("Hi! Ask me what's on your plan today, or what's for dinner.")
      .reprompt("Try asking: what's on my plan today?")
      .getResponse();
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
    try {
      const date = await getDeviceDate(handlerInput);
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
    if (!spoken) {
      return handlerInput.responseBuilder
        .speak("Which recipe would you like?")
        .reprompt("Say the name of the recipe.")
        .getResponse();
    }

    try {
      const data = await fetchJson("/api/alexa/recipe", { name: spoken });
      if (!data.found) {
        return handlerInput.responseBuilder
          .speak(data.speech || `I couldn't find a recipe called ${spoken}.`)
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
    try {
      const date = await getDeviceDate(handlerInput);
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
                  primaryText: data.title,
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

      return builder.getResponse();
    } catch (err) {
      console.error("WhatsForDinnerIntent error:", err);
      return handlerInput.responseBuilder
        .speak("Sorry, I couldn't check dinner right now.")
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
    if (!spoken) {
      return handlerInput.responseBuilder
        .speak("Which recipe should we cook?")
        .reprompt("Say the name of the recipe.")
        .getResponse();
    }

    try {
      const data = await fetchJson("/api/alexa/recipe", { name: spoken });
      if (!data.found) {
        return handlerInput.responseBuilder
          .speak(data.speech || `I couldn't find a recipe called ${spoken}.`)
          .getResponse();
      }

      const steps = data.steps || [];
      if (steps.length === 0) {
        return handlerInput.responseBuilder
          .speak(
            `${data.title} doesn't have any saved steps, so I can't walk you through it.`
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

      const ingredientsLine = data.ingredients?.length
        ? `You'll need: ${joinList(data.ingredients)}. <break time="700ms"/>`
        : "";

      const speech =
        `Let's cook ${data.title}. ${ingredientsLine}` +
        `Step 1. ${steps[0]} <break time="400ms"/> ` +
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
          `That was the last step for ${cooking.title}. Enjoy your meal!`
        )
        .getResponse();
    }

    const step = cooking.steps[idx];
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
        'You can ask: what\'s on my plan today, what\'s for dinner, or read me the recipe for something. To cook hands-free, say "walk me through" followed by a recipe name.'
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
  if (date === today) return "Today";
  const d = new Date(date + "T12:00:00Z");
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
