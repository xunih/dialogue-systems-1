import { assign, createActor, setup } from "xstate";
import { Settings, speechstate } from "speechstate";
import { createBrowserInspector } from "@statelyai/inspect";
import { KEY, NLU_KEY } from "./azure";
import { DMContext, DMEvents } from "./types";
import { snapshot } from "node:test";

const inspector = createBrowserInspector();

const azureCredentials = {
  endpoint:
    "https://northeurope.api.cognitive.microsoft.com/sts/v1.0/issuetoken",
  key: KEY,
};

const azureLanguageCredentials = {
  endpoint: "https://language-resource-672123.cognitiveservices.azure.com/language/:analyze-conversations?api-version=2024-11-15-preview" /** your Azure CLU prediction URL */,
  key: NLU_KEY /** reference to your Azure CLU key */,
  deploymentName: "appointment" /** your Azure CLU deployment */,
  projectName: "appointment" /** your Azure CLU project name */,
};

const settings: Settings = {
  azureLanguageCredentials: azureLanguageCredentials /** global activation of NLU */,
  azureCredentials: azureCredentials,
  azureRegion: "northeurope",
  asrDefaultCompleteTimeout: 0,
  asrDefaultNoInputTimeout: 5000,
  locale: "en-US",
  ttsDefaultVoice: "en-US-DavisNeural",
};

interface GrammarEntry {
  person?: string;
  //day?: string;
  //Added more entries in to the grammar
  names?: string[];
  time?: string;
  week?: string[];
  yes?: string[];
  no?: string[];
}

interface CelebrityEntry {
  person?: string;
  intro?: string;
}

const grammar: { [index: string]: GrammarEntry } = {
  vlad: { person: "Vladislav Maraev" },
  aya: { person: "Nayat Astaiza Soriano" },
  victoria: { person: "Victoria Daniilidou" },
  // Create a local simple first name database
  names: {
    names: [
      "john", "jane", "michael", "emily", "liam", "olivia", "noah", "emma", "james", "sophia",
      "william", "isabella", "benjamin", "mia", "lucas", "charlotte", "henry", "amelia",
      "alexander", "harper", "daniel", "evelyn", "matthew", "abigail", "joseph", "ella",
      "samuel", "avery", "david", "scarlett", "carter", "grace", "owen", "chloe",
      "wyatt", "victoria", "jack", "riley", "luke", "aria", "gabriel", "lily",
      "ethan", "hannah", "mason", "zoe", "logan", "nora", "elijah", "lillian",
      "jacob", "hazel", "aiden", "ellie", "sebastian", "lucy", "caleb", "madeline",
      "nathan", "aurora", "dylan", "savannah", "isaac", "penelope", "julian", "stella",
      "eli", "violet", "hunter", "bella", "anthony", "layla", "leo", "brooklyn",
      "thomas", "addison", "hudson", "natalie", "charles", "leah", "ezra", "skylar",
      "christopher", "autumn", "joshua", "paisley", "nicholas", "everly", "andrew", "maya",
      "ryan", "willow", "jaxon", "samantha", "aaron", "nova", "adam", "ariana", "alex",
      "vlad", "nayat", "victoria", "staffan"
    ]
  },
  // Store days including weekday, weekend, today, and tomorrow
  week: { week: ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday", "today", "tomorrow"] },
  //monday: { day: "Monday" },
  //tuesday: { day: "Tuesday" },
  "10": { time: "10:00" },
  "11": { time: "11:00" },
  // Store words that have a same/similar meaning to yes and no
  yesOrNo: {
    yes: ["yes", "yeah", "yep", "yup", "sure", "of course", "definitely", "absolutely"],
    no: ["no", "nah", "nope", "no way", "not at all", "uh-uh"]
  },
};

// Fuction to check if the answer to yes/no question is in the grammar 
// and if the answer means yes or no
function isInputYesOrNo(utterance: string): string | null {
  if (grammar.yesOrNo.yes?.includes(utterance.toLowerCase())) {
    return "yes";
  }
  else if (grammar.yesOrNo.no?.includes(utterance.toLowerCase())) {
    return "no";
  }
  return "invalid";
}

const dmMachine = setup({
  types: {
    /** you might need to extend these */
    context: {} as DMContext,
    events: {} as DMEvents,
  },
  actions: {
    /** define your actions here */
    "spst.speak": ({ context }, params: { utterance: string }) =>
      context.spstRef.send({
        type: "SPEAK",
        value: {
          utterance: params.utterance,
        },
      }),
    "spst.listen": ({ context }) =>
      context.spstRef.send({
        type: "LISTEN",
        value: { nlu: true } /** Local activation of NLU */,
      }),
  },
}).createMachine({
  context: ({ spawn }) => ({
    spstRef: spawn(speechstate, { input: settings }),
    lastResult: null,
    yesOrNo: null,
    profile: null,
  }),
  id: "DM",
  initial: "Prepare",
  states: {
    Prepare: {
      entry: ({ context }) => context.spstRef.send({ type: "PREPARE" }),
      on: { ASRTTS_READY: "WaitToStart" },
    },
    WaitToStart: {
      on: { CLICK: "Greeting" },
    },
    Greeting: {
      initial: "Prompt",
      on: {
        LISTEN_COMPLETE: [
          {
            target: "IntroduceRules",
            guard: ({ context }) => !!context.yesOrNo && isInputYesOrNo(context.yesOrNo[0].utterance) === "yes",

          },
          {
            target: "StartGameIntro",
            guard: ({ context }) => !!context.yesOrNo && isInputYesOrNo(context.yesOrNo[0].utterance) === "no",
          },
          {
            target: ".InvalidInput",
            guard: ({ context }) => !!context.yesOrNo && isInputYesOrNo(context.yesOrNo[0].utterance) === "invalid",
          },
          {
            target: ".NoInput",
          },
        ],
      },
      states: {
        Prompt: {
          entry: { type: "spst.speak", params: { utterance: `Hi! Welcome to Mushroom In Mind! Is this the first time you play this game?` } },
          on: { SPEAK_COMPLETE: "Ask" },
        },
        InvalidInput: {
          entry: {
            type: "spst.speak",
            params: { utterance: `I cannot understand what you said. Please say yes if you would like to learn more about the rules, or say no to directly start the game!` },
          },
          on: { SPEAK_COMPLETE: "Ask" },
        },
        NoInput: {
          entry: {
            type: "spst.speak",
            params: { utterance: `I cannot hear you! Is this the first time you play this game?` },
          },
          on: { SPEAK_COMPLETE: "Ask" },
        },
        Ask: {
          entry: { type: "spst.listen" },
          on: {
            RECOGNISED: {
              actions: assign(({ event }) => {
                return { yesOrNo: event.value };
              }),
            },
            ASR_NOINPUT: {
              actions: assign({ yesOrNo: null }),
            },
          },
        },
      },
    },
    IntroduceRules: {
      entry: { type: "spst.speak", params: { utterance: `Cool! Now I will tell you the rules! I know very well of six fungi! These images show how they look like. Think of one of them and I will guess which one you are thinking about! I will ask you five questions  about their appearance. If I guess correctly, I win! Otherwise I lose. After each round, you can click the image to know more about them! Think of one now and I will start my questions in five seconds!` } },
      after: {
        5000: { target: 'StartGame' },
      },
    },
    StartGameIntro: {
      entry: { type: "spst.speak", params: { utterance: `Nice to see you again! Let's start the game! You have five seconds to think of one fungus.` } },
      after: {
        5000: { target: 'StartGame' },
      },
    },
    StartGame: {

    },

  },
  // When the appointment is booked, users can click again to go to the Greeting state
  Done: {
    on: {
      CLICK: "Greeting",
    },
  },


});

const dmActor = createActor(dmMachine, {
  inspect: inspector.inspect,
}).start();

dmActor.subscribe((state) => {
  console.group("State update");
  console.log("State value:", state.value);
  console.log("State context:", state.context);
  console.groupEnd();
});

export function setupButton(element: HTMLButtonElement) {
  element.addEventListener("click", () => {
    dmActor.send({ type: "CLICK" });
  });
  dmActor.subscribe((snapshot) => {
    const meta: { view?: string } = Object.values(
      snapshot.context.spstRef.getSnapshot().getMeta(),
    )[0] || {
      view: undefined,
    };
    element.innerHTML = `${meta.view}`;
  });
}
