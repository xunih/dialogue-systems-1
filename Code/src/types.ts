import { List } from "microsoft-cognitiveservices-speech-sdk/distrib/lib/src/common/List";
import { Hypothesis, SpeechStateExternalEvent } from "speechstate";
import { AnyActorRef } from "xstate";

export interface DMContext {
  spstRef: AnyActorRef;
  lastResult: Hypothesis[] | null;
  color: string | null;
  shape: string | null;
  size: string | null;
  speciality: string | null;
  matchFungus: Fungus | null;
  randomIndex: number | 0;
  nluValue: NLUValue | null,
}

export interface Fungus {
  name: string;
  nr: number;
  color: string;
  shape: string;
  size: string;
  special: string;
  image: string;
  intro: string;
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
