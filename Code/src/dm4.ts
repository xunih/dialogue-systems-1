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

const color: string[] = ["red", "black", "brown"];
const shape: string[] = ["bell", "umbrella"];
const randomQuestions: string[] = ["Do you think the fungus is edible?", "Do you think the fungus can glow in the dark?", "Do you think the fungus looks like dead man's fingers"];
var randomIndex: number = 0;

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

function getARandomIndex(): number {
  const index = Math.floor(Math.random() * randomQuestions.length);
  return index;
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
    color: null,
    shape: null,
    size: null,
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
      entry: { type: "spst.speak", params: { utterance: `Cool! Now I will tell you the rules! I know very well of six fungi! These images show how they look like. Think of one of them and I will guess which one you are thinking about! I will ask you four questions  about their appearance. If I guess correctly, I win! Otherwise I lose. After each round, you can click the image to know more about them! Think of one now and I will start my questions in five seconds!` } },
      on: {
        SPEAK_COMPLETE: 'Timer'
      },
    },
    StartGameIntro: {
      entry: { type: "spst.speak", params: { utterance: `Nice to see you again! Let's start the game! You have five seconds to think of one of the fungi on the screen.` } },
      on: {
        SPEAK_COMPLETE: 'Timer'
      },
    },
    Timer: {
      after: {
        5000: { target: 'AskColor' }
      }
    },
    AskColor: {
      initial: "Prompt",
      on: {
        LISTEN_COMPLETE: [
          {
            target: "AskShape",
            guard: ({ context }) => !!context.color && color.includes(context.color[0].utterance.toLowerCase()),

          },
          {
            target: ".InvalidInput",
            guard: ({ context }) => !!context.color && !color.includes(context.color[0].utterance.toLowerCase())
          },
          {
            target: ".NoInput",
          }
        ],
      },
      states: {
        Prompt: {
          entry: { type: "spst.speak", params: { utterance: `What color is the fungus you are thinking of?` } },
          on: { SPEAK_COMPLETE: "Ask" },
        },
        InvalidInput: {
          entry: {
            type: "spst.speak",
            params: { utterance: `What you just said is not a color. What color is the fungus you are thinking of?` },
          },
          on: { SPEAK_COMPLETE: "Ask" },
        },
        NoInput: {
          entry: {
            type: "spst.speak",
            params: { utterance: `I cannot hear you! What color is the fungus you are thinking of?` },
          },
          on: { SPEAK_COMPLETE: "Ask" },
        },
        Ask: {
          entry: { type: "spst.listen" },
          on: {
            RECOGNISED: {
              actions: assign(({ event }) => {
                return { color: event.value };
              }),
            },
            ASR_NOINPUT: {
              actions: assign({ color: null }),
            },
          },
        },
      },
    },
    AskShape: {
      initial: "Prompt",
      on: {
        LISTEN_COMPLETE: [
          {
            target: "AskSize",
            guard: ({ context }) => !!context.shape && shape.includes(context.shape[0].utterance.toLowerCase()),

          },
          {
            target: ".InvalidInput",
            guard: ({ context }) => !!context.shape && !shape.includes(context.shape[0].utterance.toLowerCase())
          },
          {
            target: ".NoInput",
          }
        ],
      },
      states: {
        Prompt: {
          entry: { type: "spst.speak", params: { utterance: `What kind of shape does the fungus have?` } },
          on: { SPEAK_COMPLETE: "Ask" },
        },
        InvalidInput: {
          entry: {
            type: "spst.speak",
            params: { utterance: `Not in grammar` },
          },
          on: { SPEAK_COMPLETE: "Ask" },
        },
        NoInput: {
          entry: {
            type: "spst.speak",
            params: { utterance: `I cannot hear you! What kind of shape does the fungus have?` },
          },
          on: { SPEAK_COMPLETE: "Ask" },
        },
        Ask: {
          entry: { type: "spst.listen" },
          on: {
            RECOGNISED: {
              actions: assign(({ event }) => {
                return { shape: event.value };
              }),
            },
            ASR_NOINPUT: {
              actions: assign({ shape: null }),
            },
          },
        },
      },
    },
    AskSize: {
      initial: "Prompt",
      on: {
        LISTEN_COMPLETE: [
          {
            target: "AskSpeciality",
            guard: ({ context }) => !!context.size && context.size[0].utterance.toLowerCase() in grammar
          },
          {
            target: ".InvalidInput",
            guard: ({ context }) => !!context.size && !(context.size[0].utterance.toLowerCase() in grammar)
          },
          {
            target: ".NoInput",
          }
        ],
      },
      states: {
        Prompt: {
          entry: { type: "spst.speak", params: { utterance: randomQuestions[getARandomIndex()] } },
          on: { SPEAK_COMPLETE: "Ask" },
        },
        InvalidInput: {
          entry: {
            type: "spst.speak",
            params: { utterance: `not in grammar.` },
          },
          on: { SPEAK_COMPLETE: "Ask" },
        },
        NoInput: {
          entry: {
            type: "spst.speak",
            params: { utterance: `I cannot hear you! ` },
          },
          on: { SPEAK_COMPLETE: "Ask" },
        },
        Ask: {
          entry: { type: "spst.listen" },
          on: {
            RECOGNISED: {
              actions: assign(({ event }) => {
                return { size: event.value };
              }),
            },
            ASR_NOINPUT: {
              actions: assign({ size: null }),
            },
          },
        },
      },
    },
    AskSpeciality: {
      initial: "Prompt",
      on: {
        LISTEN_COMPLETE: [
          {
            target: "Guess",
            guard: ({ context }) => !!context.size && context.size[0].utterance.toLowerCase() in grammar
          },
          {
            target: ".InvalidInput",
            guard: ({ context }) => !!context.size && !(context.size[0].utterance.toLowerCase() in grammar)
          },
          {
            target: ".NoInput",
          }
        ],
      },
      states: {
        Prompt: {
          entry: {
            actions: assign(() => {
              return { randomIndex: getARandomIndex() };
            }), type: "spst.speak", params: { utterance: randomQuestions[randomIndex] }
          },
          on: { SPEAK_COMPLETE: "Ask" },
        },
        InvalidInput: {
          entry: {
            type: "spst.speak",
            params: { utterance: `I can't understand what you said. Please answer yes or no.` },
          },
          on: { SPEAK_COMPLETE: "Ask" },
        },
        NoInput: {
          entry: {
            type: "spst.speak",
            params: { utterance: `I cannot hear you! Does the fungus look like a giant?` },
          },
          on: { SPEAK_COMPLETE: "Ask" },
        },
        Ask: {
          entry: { type: "spst.listen" },
          on: {
            RECOGNISED: {
              actions: assign(({ event }) => {
                return { size: event.value };
              }),
            },
            ASR_NOINPUT: {
              actions: assign({ size: null }),
            },
          },
        },
      },
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
