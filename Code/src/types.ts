import { List } from "microsoft-cognitiveservices-speech-sdk/distrib/lib/src/common/List";
import { Hypothesis, SpeechStateExternalEvent } from "speechstate";
import { AnyActorRef } from "xstate";

export interface DMContext {
  spstRef: AnyActorRef;
  lastResult: Hypothesis[] | null;
  yesOrNo: Hypothesis[] | null
  profile: Profile | null;
}

interface Profile {
  colour: string;
  shape: string;
  size: string;
  habit: string;
  other: string;
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
