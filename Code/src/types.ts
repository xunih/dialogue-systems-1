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
  speciality: Hypothesis[] | null;
  matchFungus: Fungus | null;
  randomIndex: number | 0;
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
