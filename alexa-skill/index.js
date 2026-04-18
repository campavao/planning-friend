"use strict";

const Alexa = require("ask-sdk-core");

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

// Derive YYYY-MM-DD in the device's timezone from the Alexa request timestamp.
// Falls back to server UTC date if tz lookup isn't possible.
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

const LaunchRequestHandler = {
  canHandle(handlerInput) {
    return (
      Alexa.getRequestType(handlerInput.requestEnvelope) === "LaunchRequest"
    );
  },
  handle(handlerInput) {
    return handlerInput.responseBuilder
      .speak(
        "Hi! Ask me what's on your plan today, or what's for dinner."
      )
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
      const cardText =
        data.items.length === 0
          ? "Nothing planned."
          : data.items.map((i) => `• ${i.title}`).join("\n");
      return handlerInput.responseBuilder
        .speak(data.speech)
        .withSimpleCard("Your plan", cardText)
        .getResponse();
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

// Stub handlers for milestone 2+ intents. They respond gracefully instead of
// falling through to the error handler so the skill feels complete in testing.
function makeStubHandler(intentName, message) {
  return {
    canHandle(handlerInput) {
      return (
        Alexa.getRequestType(handlerInput.requestEnvelope) ===
          "IntentRequest" &&
        Alexa.getIntentName(handlerInput.requestEnvelope) === intentName
      );
    },
    handle(handlerInput) {
      return handlerInput.responseBuilder.speak(message).getResponse();
    },
  };
}

const GetRecipeIntentHandler = makeStubHandler(
  "GetRecipeIntent",
  "Recipe read-aloud is coming soon."
);

const NextStepIntentHandler = makeStubHandler(
  "NextStepIntent",
  "Step-by-step recipe walkthrough is coming soon."
);

const WhatsForDinnerIntentHandler = makeStubHandler(
  "WhatsForDinnerIntent",
  "Dinner lookup is coming soon."
);

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
        "You can ask: what's on my plan today, or what's for dinner. What would you like?"
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

exports.handler = Alexa.SkillBuilders.custom()
  .addRequestHandlers(
    LaunchRequestHandler,
    TodaysPlanIntentHandler,
    GetRecipeIntentHandler,
    NextStepIntentHandler,
    WhatsForDinnerIntentHandler,
    HelpIntentHandler,
    CancelAndStopIntentHandler,
    FallbackIntentHandler,
    SessionEndedRequestHandler
  )
  .addErrorHandlers(ErrorHandler)
  .withApiClient(new Alexa.DefaultApiClient())
  .lambda();
