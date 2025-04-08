import { assign, createActor, setup } from "xstate";
import { Settings, speechstate } from "speechstate";
import { createBrowserInspector } from "@statelyai/inspect";
import { KEY, NLU_KEY } from "./azure";
import { DMContext, DMEvents, Fungus } from "./types";
import { Context } from "microsoft-cognitiveservices-speech-sdk/distrib/lib/src/common.speech/SpeechServiceConfig";
import { randomQuestions } from "./fixedVariables";
import { findBestMatchFungus, getARandomIndex } from "./helperFunctions";

const inspector = createBrowserInspector();

const azureCredentials = {
  endpoint:
    "https://northeurope.api.cognitive.microsoft.com/sts/v1.0/issuetoken",
  key: KEY,
};

const azureLanguageCredentials = {
  endpoint: "https://language-resource-672123.cognitiveservices.azure.com/language/:analyze-conversations?api-version=2024-11-15-preview" /** your Azure CLU prediction URL */,
  key: NLU_KEY /** reference to your Azure CLU key */,
  deploymentName: "project" /** your Azure CLU deployment */,
  projectName: "project" /** your Azure CLU project name */,
};

const settings: Settings = {
  azureLanguageCredentials: azureLanguageCredentials /** global activation of NLU */,
  azureCredentials: azureCredentials,
  azureRegion: "northeurope",
  asrDefaultCompleteTimeout: 0,
  asrDefaultNoInputTimeout: 5000,
  locale: "en-US",
  ttsDefaultVoice: "en-US-AvaMultilingualNeural",
};

interface GrammarEntry {
  yes?: string[];
  no?: string[];
}

const grammar: { [index: string]: GrammarEntry } = {
  yesOrNo: {
    yes: ["yes", "yeah", "yep", "yup", "sure", "of course", "definitely", "absolutely", "yes please", "maybe", "probably", "I think so"],
    no: ["no", "nah", "nope", "no way", "not at all", "uh-uh", "I don't think so", ""]
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
    color: null,
    shape: null,
    size: null,
    speciality: null,
    matchFungus: null,
    randomIndex: 0,
    nluValue: null,
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
            guard: ({ context }) => !!context.nluValue && context.nluValue['topIntent'] === "NewUser",

          },
          {
            target: "StartGameIntro",
            guard: ({ context }) => !!context.nluValue && context.nluValue['topIntent'] === "RetuningUser"
          },
          {
            target: ".InvalidInput",
          },
        ],
      },
      states: {
        Prompt: {
          entry: { type: "spst.speak", params: { utterance: `Hello! Welcome to Mushroom In Mind! Is this the first time you play this game?` } },
          on: { SPEAK_COMPLETE: "Ask" },
        },
        InvalidInput: {
          entry: {
            type: "spst.speak",
            params: { utterance: `I cannot understand what you said or you didn't say anything. Is this the first time you play this game?` },
          },
          on: { SPEAK_COMPLETE: "Ask" },
        },
        Ask: {
          entry: { type: "spst.listen" },
          on: {
            RECOGNISED: {
              actions: assign(({ event }) => {
                return { nluValue: event.nluValue };
              }),
            },
            ASR_NOINPUT: {
              actions: assign({ nluValue: null }),
            },
          },
        },
      },
    },
    IntroduceRules: {
      entry: { type: "spst.speak", params: { utterance: `Cool! Now I will tell you the rules! I know very well of six fungi! You can see their images on your screen. Think of one of them and I will guess which one you are thinking of! I will ask you some questions about them. If I guess correctly, I win! Otherwise I lose. After each round, you can click the image to know more about them! Think of one now and I will start my questions in five seconds!` } },
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
            guard: ({ context }) => context.nluValue?.entities[0]?.category === "Color",

          },
          {
            target: ".InvalidInput",
          },
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
            params: { utterance: `What you just said is not a color or you didn't say anything. What color is the fungus you are thinking of?` },
          },
          on: { SPEAK_COMPLETE: "Ask" },
        },
        Ask: {
          entry: { type: "spst.listen" },
          on: {
            RECOGNISED: {
              actions: assign(({ event }) => {
                return { nluValue: event.nluValue, color: event.nluValue?.entities[0]?.text };
              }),
            },
            ASR_NOINPUT: {
              actions: assign({ nluValue: null }),
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
            guard: ({ context }) => context.nluValue?.entities[0]?.category === "Shape",

          },
          {
            target: ".InvalidInput",
          },
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
            params: { utterance: `What you just said isn't valid or you didn't say anything! What kind of shape does the fungus have?` },
          },
          on: { SPEAK_COMPLETE: "Ask" },
        },
        Ask: {
          entry: { type: "spst.listen" },
          on: {
            RECOGNISED: {
              actions: assign(({ event }) => {
                return { nluValue: event.nluValue, shape: event.nluValue?.entities[0]?.text };
              }),
            },
            ASR_NOINPUT: {
              actions: assign({ nluValue: null }),
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
            guard: ({ context }) => context.nluValue?.entities[0]?.extraInformation[0]?.key === "yes" || context.nluValue?.entities[0]?.extraInformation[0]?.key === "no",
          },
          {
            target: ".InvalidInput",
          },
        ],
      },
      states: {
        Prompt: {
          entry: { type: "spst.speak", params: { utterance: "Does it look like a giant?" } },
          on: { SPEAK_COMPLETE: "Ask" },
        },
        InvalidInput: {
          entry: {
            type: "spst.speak",
            params: { utterance: `I cannot understand what you said or you didn't say anything. Please answer yes or no!` },
          },
          on: { SPEAK_COMPLETE: "Ask" },
        },
        Ask: {
          entry: { type: "spst.listen" },
          on: {
            RECOGNISED: {
              actions: assign(({ event }) => {
                return { nluValue: event.nluValue, size: event.nluValue.entities[0]?.extraInformation[0]?.key };
              }),
            },
            ASR_NOINPUT: {
              actions: assign({ nluValue: null }),
            },
          },
        },
      },
    },
    AskSpeciality: {
      entry:
        assign(() => {
          var randomIndex = getARandomIndex();
          return { randomIndex };
        }),
      initial: "Prompt",
      on: {
        LISTEN_COMPLETE: [
          {
            target: "Guess",
            guard: ({ context }) => context.nluValue?.entities[0]?.extraInformation[0]?.key === "yes" || context.nluValue?.entities[0]?.extraInformation[0]?.key === "no",
          },
          {
            target: ".InvalidInput",
          },
        ],
      },
      states: {
        Prompt: {
          entry: {
            type: "spst.speak", params: ({ context }) => ({ utterance: randomQuestions[context.randomIndex] }),
          },
          on: { SPEAK_COMPLETE: "Ask" },
        },
        InvalidInput: {
          entry: {
            type: "spst.speak",
            params: { utterance: `I can't understand what you said or you didn't say anything. Please answer yes or no.` },
          },
          on: { SPEAK_COMPLETE: "Ask" },
        },
        Ask: {
          entry: { type: "spst.listen" },
          on: {
            RECOGNISED: {
              actions: assign(({ event }) => {
                return { nluValue: event.nluValue, speciality: event.nluValue.entities[0]?.extraInformation[0]?.key };
              }),
            },
            ASR_NOINPUT: {
              actions: assign({ nluValue: null }),
            },
          },
        },
      },
    },
    Guess: {
      entry:
        assign(({ context }) => {
          const matchFungus = findBestMatchFungus(
            context.color!.toLowerCase(),
            context.shape!.toLowerCase(),
            context.size!.toLowerCase(),
            context.speciality!.toLowerCase(),
            context.randomIndex,
          );

          return { matchFungus };
        }),
      initial: "Prompt",
      on: {
        LISTEN_COMPLETE: [
          {
            target: "Win",
            guard: ({ context }) => context.nluValue?.entities[0]?.extraInformation[0]?.key === "yes",
          },
          {
            target: "Lose",
            guard: ({ context }) => context.nluValue?.entities[0]?.extraInformation[0]?.key === "no",
          },
          {
            target: ".InvalidInput",
          },
        ],
      },
      states: {
        Prompt: {
          entry: {
            type: "spst.speak", params: ({ context }) => ({ utterance: `I think No. ${context.matchFungus?.nr} is the one you are thinking of! ${context.matchFungus?.intro} Is my guess correct?` }),
          },
          on: { SPEAK_COMPLETE: "Ask" },
        },
        InvalidInput: {
          entry: {
            type: "spst.speak",
            params: ({ context }) => ({ utterance: `I cannot understand you or you didn't say anything! Is No. ${context.matchFungus?.nr} the one you are thinking of?` }),
          },
          on: { SPEAK_COMPLETE: "Ask" },
        },
        Ask: {
          entry: { type: "spst.listen" },
          on: {
            RECOGNISED: {
              actions: assign(({ event }) => {
                return { nluValue: event.nluValue };
              }),
            },
            ASR_NOINPUT: {
              actions: assign({ nluValue: null }),
            },
          },
        },
      },
    },
    Win: {
      initial: "Prompt",
      on: {
        LISTEN_COMPLETE: [
          {
            target: "StartGameIntro",
            guard: ({ context }) => context.nluValue?.entities[0]?.extraInformation[0]?.key === "yes",
          },
          {
            target: "Done",
            guard: ({ context }) => context.nluValue?.entities[0]?.extraInformation[0]?.key === "no",
          },
          {
            target: ".InvalidInput",
          },
        ],
      },
      states: {
        Prompt: {
          entry: {
            type: "spst.speak", params: {
              utterance: `Woohoo! I won! Would you like to play again?`,
            }
          },
          on: { SPEAK_COMPLETE: "Ask" }
        },
        InvalidInput: {
          entry: {
            type: "spst.speak",
            params: { utterance: `I cannot understand you or you didn't say anything! Would you like to play again?` },
          },
          on: { SPEAK_COMPLETE: "Ask" },
        },
        Ask: {
          entry: { type: "spst.listen" },
          on: {
            RECOGNISED: {
              actions: assign(({ event }) => {
                return { nluValue: event.nluValue };
              }),
            },
            ASR_NOINPUT: {
              actions: assign({ nluValue: null }),
            },
          },
        },
      },
    },
    Lose: {
      initial: "Prompt",
      on: {
        LISTEN_COMPLETE: [
          {
            target: "StartGameIntro",
            guard: ({ context }) => context.nluValue?.entities[0]?.extraInformation[0]?.key === "yes",
          },
          {
            target: "Done",
            guard: ({ context }) => context.nluValue?.entities[0]?.extraInformation[0]?.key === "no",
          },
          {
            target: ".InvalidInput",
          },
        ],
      },
      states: {
        Prompt: {
          entry: {
            type: "spst.speak", params: {
              utterance: `Oh no! I was wrong! I will win next time! Do you accept my challenge?`,
            }
          },
          on: { SPEAK_COMPLETE: "Ask" }
        },
        Ask: {
          entry: { type: "spst.listen" },
          on: {
            RECOGNISED: {
              actions: assign(({ event }) => {
                return { nluValue: event.nluValue };
              }),
            },
            ASR_NOINPUT: {
              actions: assign({ nluValue: null }),
            },
          },
        },
        InvalidInput: {
          entry: {
            type: "spst.speak",
            params: { utterance: `I cannot understand you or you didn't say anything! Would you like to play again?` },
          },
          on: { SPEAK_COMPLETE: "Ask" },
        },
      },
    },
    Done: {
      entry: { type: "spst.speak", params: { utterance: `It was fun! Hope to see you again!` } },
      on: {
        CLICK: "Greeting",
      },
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
