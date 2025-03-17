import { List } from "microsoft-cognitiveservices-speech-sdk/distrib/lib/src/common/List";
import { Hypothesis, SpeechStateExternalEvent } from "speechstate";
import { AnyActorRef } from "xstate";

export interface DMContext {
  spstRef: AnyActorRef;
  lastResult: Hypothesis[] | null;
  yesOrNo: Hypothesis[] | null
  color: Hypothesis[] | null;
  shape: Hypothesis[] | null;
  size: Hypothesis[] | null;
}

/*
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
}*/

export type DMEvents = SpeechStateExternalEvent | { type: "CLICK" };
