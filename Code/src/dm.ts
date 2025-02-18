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
  //Added more entries in to the grammar
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

function isInGrammar(utterance: string) {
  return utterance.toLowerCase() in grammar;
}

// Function to check if the name provided by users is in the grammar
function isNameValid(utterance: string): boolean {
  if (grammar.names.names?.includes(utterance.toLowerCase())) {
    return true;
  }
  return false;
}

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

// Function to check if the provided date is in the grammar or if it's a valid date
function isDateValid(utterance: string): boolean {
  // check if the provided day is in the grammar
  var isWeekDay = grammar.week.week?.includes(utterance.toLowerCase());
  // use regex to remove date ordinals (st, nd, rd, th)
  utterance = utterance.replace(/(\d+)(st|nd|rd|th)/, '$1');
  // format the date into the form of "Month Day", eg., March 15
  const normalisedUtterance = utterance.replace(/(\d+)\s*of\s*(\w+)/, '$2 $1');
  // create a date object with a specified date and time
  var date = new Date(normalisedUtterance);
  // check if it's a valid date
  var ifDateValid = !isNaN(date.getTime());
  // handle date like March 32, 
  // becuse it can automatically convert it to a valid date Mrach 1 when creating the date object
  const parsedDay = date.getDate();
  // compare the day in the user input and the parsed day corrected when creating the date object
  // if it's not the same, return false
  var day = Number(normalisedUtterance.split(" ")[1])
  if (parsedDay !== day && !isWeekDay) {
    return false;
  }
  // if it's a valid date or the day is in the grammar return true
  if (ifDateValid || isWeekDay) {
    return true;
  }
  return false;
}

// Function to check if the provided time is valid
// Limitation: When the user input consists of 3 numbers, it might be recognised as an invalid time such as 8:17
function isTimeValid(utterance: string): boolean {
  var isTimeValid = false;
  var hr;
  var min;
  /* I noticed that if the speech recognition notice that the user input is a time,
  it will convert it to a format in HH:MM, which inlcudes ":" 
  Hence, the function first check if it includes ":",
  if so, the provided time is valid.
  if not, it will check the length of the utterance.
  If it's a 4-digit number, get the number for hour and minute and validate.
  If it's a 1 or 2-digit number, check if it's a valid hour
  */
  if (utterance.includes(":")) {
    isTimeValid = true
  } else if (utterance.length === 4) {
    hr = Number(utterance.slice(0, 2));
    min = Number(utterance.slice(-2));
    if (hr < 24 && min < 60) {
      isTimeValid = true;
    }
  } else if (utterance.length === 1 || utterance.length === 2) {
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
      // when the machine is ready, the user click the button to say Hi:)
      on: { CLICK: "GreetingFromUser" },
    },
    // A state handling user's greeting
    // Limitation: It accepts all user input. It doesn't check if it's Hi or any other invalid inputs
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
          // when the system detects users' input, pass to the Greeting state
          {
            target: "Greeting",
            guard: ({ context }) => !!context.greetingFromUser,
          },
          // if the user isn't speaking, return to the initial state
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
          // If a valid name is provided, it passes to state AskForDate
          {
            target: "AskForDate",
            guard: ({ context }) => !!context.name && isNameValid(context.name![0].utterance),
          },
          // if the name is not in the grammar or no user input detected, reraise the question
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
            params: { utterance: `The name you said seems invalid. Could you say again or provide another name?` },
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
      initial: "Prompt",
      on: {
        LISTEN_COMPLETE: [
          // if the provided date is valid, move forward to state IfWholeDay
          {
            target: "IfWholeDay",
            guard: ({ context }) => !!context.date && isDateValid(context.date![0].utterance)
          },
          // if the date is not in the grammar, invalid, or no user input detected, reraise the question
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
          // If the user answers no, pass to state AskForTime
          // if the answer is yes, pass to state NoTimeProvided
          // if the answer is not a valid date, reraise question
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
            params: { utterance: `I can't understand you! Will it take the whole day?` },
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
          // If the time provided is valid, pass it to state WithATime
          // if the time is not valid or not in the grammar, reraise the question
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
            params: { utterance: `It's not a valid time. Could you provide a valid time?` },
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
          // if the user wants to book an appointment, move to state AppointmentBooked
          // otherwise the machine will ask for a person again
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
            params: ({ context }) => ({
              utterance: `I can't hear you! Do you want me to create an appointment with ${context.name![0].utterance}
              on ${context.date![0].utterance}`,
            }),
          },
          on: { SPEAK_COMPLETE: "Ask" },
        },
        InvalidInput: {
          entry: {
            type: "spst.speak",
            params: ({ context }) => ({
              utterance: `I can't understand you! Do you want me to create an appointment with ${context.name![0].utterance}
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
          // if the user answers yes, goes to state AppointmentBook
          // otherwise ask for a person again
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
              utterance: `I can't hear you. Do you want me to create an appointment with ${context.name![0].utterance}
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
    // When the appointment is booked, users can click again to go to the Greeting state
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
