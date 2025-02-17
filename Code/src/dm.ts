import { assign, createActor, setup } from "xstate";
import { Settings, speechstate } from "speechstate";
import { createBrowserInspector } from "@statelyai/inspect";
import { KEY } from "./azure";
import { DMContext, DMEvents } from "./types";
import { snapshot } from "node:test";

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
  //day?: string;
  names?: string[];
  time?: string;
  week?: string[];
  yes?: string[];
  no?: string[];
}

const grammar: { [index: string]: GrammarEntry } = {
  vlad: { person: "Vladislav Maraev" },
  aya: { person: "Nayat Astaiza Soriano" },
  victoria: { person: "Victoria Daniilidou" },
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
      "ryan", "willow", "jaxon", "samantha", "aaron", "nova", "adam", "ariana"
    ]
  },
  week: { week: ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday", "today", "tomorrow"] },
  //monday: { day: "Monday" },
  //tuesday: { day: "Tuesday" },
  "10": { time: "10:00" },
  "11": { time: "11:00" },
  yesOrNo: {
    yes: ["yes", "yeah", "yep", "yup", "sure", "of course", "definitely", "absolutely"],
    no: ["no", "nah", "nope", "no way", "not at all", "uh-uh"]
  },
};

function isInGrammar(utterance: string) {
  return utterance.toLowerCase() in grammar;
}

function isNameValid(utterance: string): boolean {
  console.log(utterance)
  console.log(grammar.names.names)
  if (grammar.names.names?.includes(utterance.toLowerCase())) {
    console.log("heyhye")
    return true;
  }
  return false;
}

function isInputYesOrNo(utterance: string): string | null {
  if (grammar.yesOrNo.yes?.includes(utterance.toLowerCase())) {
    return "yes";
  }
  else if (grammar.yesOrNo.no?.includes(utterance.toLowerCase())) {
    return "no";
  }
  return "invalid";
}

function isDateValid(utterance: string): boolean {
  utterance = utterance.replace(/(\d+)(st|nd|rd|th)/, '$1');
  const normalisedUtterance = utterance.replace(/(\d+)\s*of\s*(\w+)/, '$2 $1');
  var date = new Date(normalisedUtterance);
  var ifDateValid = !isNaN(date.getTime());
  var isWeekDay = grammar.week.week?.includes(utterance.toLowerCase());
  if (ifDateValid || isWeekDay) {
    return true;
  }
  return false;
}

function isTimeValid(utterance: string): boolean {
  var isTimeValid = false;
  var hr;
  var min;
  console.log(utterance)
  if (utterance.includes(":")) {
    isTimeValid = true
  } else if (utterance.length === 4) {
    hr = Number(utterance.slice(0, 2));
    min = Number(utterance.slice(-2));
    if (hr < 24 && min < 60) {
      isTimeValid = true;
    }
  }
  else if (utterance.length === 1 || utterance.length === 2) {
    if (0 < Number(utterance) && Number(utterance) < 24) {
      isTimeValid = true;
    }
  }
  return isTimeValid
};


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
        LISTEN_COMPLETE: [
          {
            target: "Greeting",
            guard: ({ context }) => !!context.greetingFromUser,
          },
          {
            target: "Prepare"
          }
        ],
      },
    },
    Greeting: {
      initial: "Prompt",
      on: {
        LISTEN_COMPLETE: [
          {
            target: "AskForDate",
            guard: ({ context }) => !!context.name && isNameValid(context.name![0].utterance),
          },
          {
            target: ".InvalidInput",
            guard: ({ context }) => !!context.name && !isNameValid(context.name![0].utterance),
          },
          { target: ".NoInput" },
        ],
      },
      states: {
        Prompt: {
          entry: { type: "spst.speak", params: { utterance: `Let's create an appointment!` } },
          on: { SPEAK_COMPLETE: "AskForPerson" },
        },
        InvalidInput: {
          entry: {
            type: "spst.speak",
            params: { utterance: `The name you said is not valid. Could you say again?` },
          },
          on: { SPEAK_COMPLETE: "Ask" },
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
            guard: ({ context }) => !!context.date && isDateValid(context.date![0].utterance)
          },
          {
            target: ".InvalidInput",
            guard: ({ context }) => !!context.date && !isDateValid(context.date![0].utterance)
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
        InvalidInput: {
          entry: {
            type: "spst.speak",
            params: { utterance: `It's not a valid day. On which day is your meeting?` },
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
              !!context.ifWholeDay && isInputYesOrNo(context.ifWholeDay![0].utterance) === "no",

          },
          {
            target: "NoTimeProvided",
            guard: ({ context }) =>
              !!context.ifWholeDay && isInputYesOrNo(context.ifWholeDay![0].utterance) === "yes",

          },
          {
            target: ".InvalidInput",
            guard: ({ context }) =>
              !!context.ifWholeDay && isInputYesOrNo(context.ifWholeDay![0].utterance) === "invalid",
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
            guard: ({ context }) => !!context.time && isTimeValid(context.time![0].utterance)
          },
          {
            target: ".InvalidInput",
            guard: ({ context }) => !!context.time && !isTimeValid(context.time![0].utterance)
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
        InvalidInput: {
          entry: {
            type: "spst.speak",
            params: { utterance: `It's not a valid time. What time is your meeting?` },
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
              !!context.ifCreateAppointment && isInputYesOrNo(context.ifCreateAppointment![0].utterance) === "yes",
          },
          {
            target: "Greeting.AskForPerson",
            guard: ({ context }) =>
              !!context.ifCreateAppointment && isInputYesOrNo(context.ifCreateAppointment![0].utterance) === "no",
          },
          {
            target: ".InvalidInput",
            guard: ({ context }) =>
              !!context.ifCreateAppointment && isInputYesOrNo(context.ifCreateAppointment![0].utterance) === "invalid",
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
              !!context.ifCreateAppointment && isInputYesOrNo(context.ifCreateAppointment![0].utterance) === "yes",
          },
          {
            target: "Greeting.AskForPerson",
            guard: ({ context }) =>
              !!context.ifCreateAppointment && isInputYesOrNo(context.ifCreateAppointment![0].utterance) === "no",
          },
          {
            target: ".InvalidInput",
            guard: ({ context }) =>
              !!context.ifCreateAppointment && isInputYesOrNo(context.ifCreateAppointment![0].utterance) === "invalid",
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
