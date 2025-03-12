import { Hypothesis, SpeechStateExternalEvent } from "speechstate";
import { AnyActorRef } from "xstate";

export interface DMContext {
  spstRef: AnyActorRef;
  lastResult: Hypothesis[] | null;
  // Added new variables to store different user inputs
  nluValue: NLUValue | null,
  greetingFromUser: Hypothesis[] | null;
  name: Hypothesis[] | null;
  date: Hypothesis[] | null;
  ifWholeDay: Hypothesis[] | null;
  time: Hypothesis[] | null;
  ifCreateAppointment: Hypothesis[] | null;
}

interface NLUValue {
  topIntent?: string;
  entities: Entity[];
}

type Entity = {
  category: string;
  text: string;
  offset: number;
  length: number;
  confidenceScore: number;
};

export type DMEvents = SpeechStateExternalEvent | { type: "CLICK" };
