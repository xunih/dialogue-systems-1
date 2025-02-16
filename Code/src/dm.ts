import { assign, createActor, setup } from "xstate";
import { Settings, speechstate } from "speechstate";
import { createBrowserInspector } from "@statelyai/inspect";
import { KEY } from "./azure";
import { DMContext, DMEvents } from "./types";

const inspector = createBrowserInspector();

const azureCredentials = {
  endpoint:
    "https://northeurope.api.cognitive.microsoft.com/sts/v1.0/issuetoken",
  key: KEY,
};

const settings: Settings = {
  azureCredentials: azureCredentials,
  azureRegion: "northeurope",
  asrDefaultCompleteTimeout: 0,
  asrDefaultNoInputTimeout: 5000,
  locale: "en-US",
  ttsDefaultVoice: "en-US-DavisNeural",
};

interface GrammarEntry {
  person?: string;
  day?: string;
  time?: string;
  yes?: string[];
  no?: string[];
}

const grammar: { [index: string]: GrammarEntry } = {
  vlad: { person: "Vladislav Maraev" },
  aya: { person: "Nayat Astaiza Soriano" },
  victoria: { person: "Victoria Daniilidou" },
  monday: { day: "Monday" },
  tuesday: { day: "Tuesday" },
  "10": { time: "10:00" },
  "11": { time: "11:00" },
  yes: { yes: ["yes", "yeah", "yep", "yup", "sure", "of course", "definitely", "absolutely"] },
  no: { no: ["no", "nah", "nope", "no way", "not at all", "uh-uh"] },
};

function isInGrammar(utterance: string) {
  return utterance.toLowerCase() in grammar;
}

function ifInputIsYesOrNo(utterance: string): string | null {
  if (grammar.yes.yes?.includes(utterance.toLowerCase())) {
    return "yes"
  }
  else if (grammar.no.no?.includes(utterance.toLowerCase())) {
    return "no"
  }
  return "invalid"
}

function getPerson(utterance: string) {
  return (grammar[utterance.toLowerCase()] || {}).person;
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
      }),
  },
}).createMachine({
  context: ({ spawn }) => ({
    spstRef: spawn(speechstate, { input: settings }),
    lastResult: null,
    greetingFromUser: null,
    name: null,
    date: null,
    time: null,
    ifWholeDay: null,
    ifCreateAppointment: null,
  }),
  id: "DM",
  initial: "Prepare",
  states: {
    Prepare: {
      entry: ({ context }) => context.spstRef.send({ type: "PREPARE" }),
      on: { ASRTTS_READY: "WaitToStart" },
    },
    WaitToStart: {
      on: { CLICK: "GreetingFromUser" },
    },
    GreetingFromUser: {
      initial: "Ask",
      entry: { type: "spst.listen" },
      on: {
        LISTEN_COMPLETE: [
          {
            target: "Greeting",
            guard: ({ context }) => !!context.greetingFromUser,
          },
        ],
      },
      states: {
        Ask: {
          entry: { type: "spst.listen" },
          on: {
            RECOGNISED: {
              actions: assign(({ event }) => {
                return { greetingFromUser: event.value };
              }),
            },
            ASR_NOINPUT: {
              actions: assign({ greetingFromUser: null }),
            },
          },
        },
      },

    },
    Greeting: {
      initial: "Prompt",
      on: {
        LISTEN_COMPLETE: [
          {
            target: "AskForDate",
            guard: ({ context }) => !!context.name,
          },
          { target: ".NoInput" },
        ],
      },
      states: {
        Prompt: {
          entry: { type: "spst.speak", params: { utterance: `Let's create an appointment!` } },
          on: { SPEAK_COMPLETE: "AskForPerson" },
        },
        NoInput: {
          entry: {
            type: "spst.speak",
            params: { utterance: `I can't hear you! Who are you meeting with?` },
          },
          on: { SPEAK_COMPLETE: "Ask" },
        },
        AskForPerson: {
          entry: { type: "spst.speak", params: { utterance: `Who are you meeting with?` } },
          on: { SPEAK_COMPLETE: "Ask" },
        },
        Ask: {
          entry: { type: "spst.listen" },
          on: {
            RECOGNISED: {
              actions: assign(({ event }) => {
                return { name: event.value };
              }),
            },
            ASR_NOINPUT: {
              actions: assign({ name: null }),
            },
          },
        },
      },
    },
    AskForDate: {
      /*
      entry: {
        type: "spst.speak",
        params: ({ context }) => ({
          utterance: `You just said: ${context.lastResult![0].utterance}. And it ${
            isInGrammar(context.lastResult![0].utterance) ? "is" : "is not"
          } in the grammar.`,
        }),
      },
      on: { SPEAK_COMPLETE: "Done" },*/
      initial: "Prompt",
      on: {
        LISTEN_COMPLETE: [
          {
            target: "IfWholeDay",
            guard: ({ context }) => !!context.date,
          },
          { target: ".NoInput" },
        ],
      },
      states: {
        Prompt: {
          entry: { type: "spst.speak", params: { utterance: `On which day is your meeting?` } },
          on: { SPEAK_COMPLETE: "Ask" },
        },
        NoInput: {
          entry: {
            type: "spst.speak",
            params: { utterance: `I can't hear you! On which day is your meeting?` },
          },
          on: { SPEAK_COMPLETE: "Ask" },
        },
        Ask: {
          entry: { type: "spst.listen" },
          on: {
            RECOGNISED: {
              actions: assign(({ event }) => {
                return { date: event.value };
              }),
            },
            ASR_NOINPUT: {
              actions: assign({ date: null }),
            },
          },
        },
      },
    },
    IfWholeDay: {
      initial: "Prompt",
      on: {
        LISTEN_COMPLETE: [
          {
            target: "AskForTime",
            guard: ({ context }) =>
              !!context.ifWholeDay && ifInputIsYesOrNo(context.ifWholeDay![0].utterance) === "no",

          },
          {
            target: "NoTimeProvided",
            guard: ({ context }) =>
              !!context.ifWholeDay && ifInputIsYesOrNo(context.ifWholeDay![0].utterance) === "yes",

          },
          {
            target: ".InvalidInput",
            guard: ({ context }) =>
              !!context.ifWholeDay && ifInputIsYesOrNo(context.ifWholeDay![0].utterance) === "invalid",
          },
          { target: ".NoInput" },
        ],
      },
      states: {
        Prompt: {
          entry: { type: "spst.speak", params: { utterance: `Will it take the whole day?` } },
          on: { SPEAK_COMPLETE: "Ask" },
        },
        NoInput: {
          entry: {
            type: "spst.speak",
            params: { utterance: `I can't hear you! Will it take the whole day?` },
          },
          on: { SPEAK_COMPLETE: "Ask" },
        },
        InvalidInput: {
          entry: {
            type: "spst.speak",
            params: { utterance: `I can't understand. Will it take the whole day?` },
          },
          on: { SPEAK_COMPLETE: "Ask" },
        },
        Ask: {
          entry: { type: "spst.listen" },
          on: {
            RECOGNISED: {
              actions: assign(({ event }) => {
                return { ifWholeDay: event.value };
              }),
            },
            ASR_NOINPUT: {
              actions: assign({ ifWholeDay: null }),
            },
          },
        },
      },
    },
    AskForTime: {
      initial: "Prompt",
      on: {
        LISTEN_COMPLETE: [
          {
            target: "WithATime",
            guard: ({ context }) => !!context.time,
          },
          { target: ".NoInput" },
        ],
      },
      states: {
        Prompt: {
          entry: { type: "spst.speak", params: { utterance: `What time is your meeting?` } },
          on: { SPEAK_COMPLETE: "Ask" },
        },
        NoInput: {
          entry: {
            type: "spst.speak",
            params: { utterance: `I can't hear you! What time is your meeting?` },
          },
          on: { SPEAK_COMPLETE: "Ask" },
        },
        Ask: {
          entry: { type: "spst.listen" },
          on: {
            RECOGNISED: {
              actions: assign(({ event }) => {
                return { time: event.value };
              }),
            },
            ASR_NOINPUT: {
              actions: assign({ time: null }),
            },
          },
        },
      },
    },
    NoTimeProvided: {
      initial: "Prompt",
      on: {
        LISTEN_COMPLETE: [
          {
            target: "AppointmentBooked",
            guard: ({ context }) =>
              !!context.ifCreateAppointment && ifInputIsYesOrNo(context.ifCreateAppointment![0].utterance) === "yes",
          },
          {
            target: "Greeting.AskForPerson",
            guard: ({ context }) =>
              !!context.ifCreateAppointment && ifInputIsYesOrNo(context.ifCreateAppointment![0].utterance) === "no",
          },
          {
            target: ".InvalidInput",
            guard: ({ context }) =>
              !!context.ifCreateAppointment && ifInputIsYesOrNo(context.ifCreateAppointment![0].utterance) === "invalid",
          },
          { target: ".NoInput" },
        ],
      },
      states: {
        Prompt: {
          entry: {
            type: "spst.speak",
            params: ({ context }) => ({
              utterance: `Do you want me to create an appointment with ${context.name![0].utterance}
              on ${context.date![0].utterance}`,
            }),
          },
          on: { SPEAK_COMPLETE: "Ask" },
        },
        NoInput: {
          entry: {
            type: "spst.speak",
            params: { utterance: `I can't hear you! Could you say again?` },
          },
          on: { SPEAK_COMPLETE: "Ask" },
        },
        InvalidInput: {
          entry: {
            type: "spst.speak",
            params: ({ context }) => ({
              utterance: `Do you want me to create an appointment with ${context.name![0].utterance}
              on ${context.date![0].utterance}`,
            }),
          },
          on: { SPEAK_COMPLETE: "Ask" },
        },
        Ask: {
          entry: { type: "spst.listen" },
          on: {
            RECOGNISED: {
              actions: assign(({ event }) => {
                return { ifCreateAppointment: event.value };
              }),
            },
            ASR_NOINPUT: {
              actions: assign({ ifCreateAppointment: null }),
            },
          },
        },
      },
    },
    WithATime: {
      initial: "Prompt",
      on: {
        LISTEN_COMPLETE: [
          {
            target: "AppointmentBooked",
            guard: ({ context }) =>
              !!context.ifCreateAppointment && ifInputIsYesOrNo(context.ifCreateAppointment![0].utterance) === "yes",
          },
          {
            target: "Greeting.AskForPerson",
            guard: ({ context }) =>
              !!context.ifCreateAppointment && ifInputIsYesOrNo(context.ifCreateAppointment![0].utterance) === "no",
          },
          {
            target: ".InvalidInput",
            guard: ({ context }) =>
              !!context.ifCreateAppointment && ifInputIsYesOrNo(context.ifCreateAppointment![0].utterance) === "invalid",
          },
          { target: ".NoInput" },
        ],
      },
      states: {
        Prompt: {
          entry: {
            type: "spst.speak",
            params: ({ context }) => ({
              utterance: `Do you want me to create an appointment with ${context.name![0].utterance}
              on ${context.date![0].utterance} at ${context.time![0].utterance}`,
            }),
          },
          on: { SPEAK_COMPLETE: "Ask" },
        },
        NoInput: {
          entry: {
            type: "spst.speak",
            params: ({ context }) => ({
              utterance: `I can't hear youƒ. Do you want me to create an appointment with ${context.name![0].utterance}
              on ${context.date![0].utterance} at ${context.time![0].utterance}`,
            }),
          },
          on: { SPEAK_COMPLETE: "Ask" },
        },
        InvalidInput: {
          entry: {
            type: "spst.speak",
            params: ({ context }) => ({
              utterance: `I can't understand. Do you want me to create an appointment with ${context.name![0].utterance}
              on ${context.date![0].utterance} at ${context.time![0].utterance}`,
            }),
          },
          on: { SPEAK_COMPLETE: "Ask" },
        },
        Ask: {
          entry: { type: "spst.listen" },
          on: {
            RECOGNISED: {
              actions: assign(({ event }) => {
                return { ifCreateAppointment: event.value };
              }),
            },
            ASR_NOINPUT: {
              actions: assign({ ifCreateAppointment: null }),
            },
          },
        },
      },
    },
    AppointmentBooked: {
      entry: {
        type: "spst.speak",
        params: { utterance: `You appointment has been created!` },
      },
      on: { SPEAK_COMPLETE: "Done" },
    },
    Done: {
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
