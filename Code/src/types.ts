import { Hypothesis, SpeechStateExternalEvent } from "speechstate";
import { AnyActorRef } from "xstate";

export interface DMContext {
  spstRef: AnyActorRef;
  lastResult: Hypothesis[] | null;
  // Added new variables to store different user inputs
  greetingFromUser: Hypothesis[] | null;
  name: Hypothesis[] | null;
  date: Hypothesis[] | null;
  ifWholeDay: Hypothesis[] | null;
  time: Hypothesis[] | null;
  ifCreateAppointment: Hypothesis[] | null;
}

export type DMEvents = SpeechStateExternalEvent | { type: "CLICK" };
