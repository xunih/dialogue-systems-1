import { Fungus } from "./types";
import fungiData from "./fungiData.json"
import { randomQuestions } from "./fixedVariables";

export function getARandomIndex(): number {
  const index = Math.floor(Math.random() * randomQuestions.length);
  return index;
}

export function findBestMatchFungus(color: string, shape: string, size: string, speciality: string, questionIndex: number): Fungus | null {
  var fungi: Fungus[] = fungiData;
  var bestMatchCount: number = 0;
  var bestMatchFungus: Fungus | null = null;
  if (color === "red") {
    bestMatchFungus = fungi[3]
  } else if (shape.includes("finger")) {
    bestMatchFungus = fungi[4]
  } else {
    fungi.forEach((fungus) => {
      console.log("inside for each")
      console.log(fungus)
      let count: number = 0;

      if (fungus.color.includes(color)) {
        count++;
      }
      if (fungus.shape.includes(shape)) {
        count++;
      }
      if (size === "yes") {
        if (fungus.size === "tall") {
          count++;
          console.log("tall")
        }
      } else if (size === "no") {
        if (fungus.size === "small") {
          count++;
        }
      }
      if (randomQuestions[questionIndex].includes(speciality)) {
        count++;
      }

      if (count > bestMatchCount) {
        bestMatchCount = count;
        bestMatchFungus = fungus;
      }
    })
  }
  return bestMatchFungus
}