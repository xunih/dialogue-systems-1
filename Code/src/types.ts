import { List } from "microsoft-cognitiveservices-speech-sdk/distrib/lib/src/common/List";
import { Hypothesis, SpeechStateExternalEvent } from "speechstate";
import { AnyActorRef } from "xstate";

export interface DMContext {
  spstRef: AnyActorRef;
  lastResult: Hypothesis[] | null;
  // Added new variables to store different user inputs
  nluValue: NLUValue | null,
  greetingFromUser: Hypothesis[] | null;
  name: string | null;
  date: string | null;
  ifWholeDay: string | null;
  time: string | null;
  ifCreateAppointment: string | null;
}

interface NLUValue {
  topIntent?: string;
  entities: Entity[];
}

type Entity = {
  category: string;
  text: string;
  extraInformation: YesOrNo[]
};

type YesOrNo = {
  extraInformationKind: string,
  key: string
}

export type DMEvents = SpeechStateExternalEvent | { type: "CLICK" };
