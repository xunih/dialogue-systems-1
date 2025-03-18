import { Fungus } from "./types";
import fungiData from "./fungiData.json"
import { randomQuestions } from "./fixedVariagbles";

export function getARandomIndex(): number {
  const index = Math.floor(Math.random() * randomQuestions.length);
  return index;
}

export function findBestMatchFungus(color: string, shape: string, size: string, speciality: string, questionIndex: number): Fungus | null {
    var fungi: Fungus[] = fungiData;
    var bestMatchCount: number = 0;
    var bestMatchFungus: Fungus | null = null;
    fungi.forEach((fungus) => {
      console.log("inside for each")
      console.log(fungus)
      let count: number = 0;
      if (fungus.color.includes(color)) {
        count++;
        console.log("Colour")
      }
      if (fungus.shape.includes(shape)) {
        count++;
        console.log("shape")
      }
      if (size === "yes") {
        if (fungus.size === "tall") {
          count++;
          console.log("tall")
        }
      } else if (size === "no") {
        if (fungus.size === "small") {
          count++;
          console.log("small")
        }
      }
      if (randomQuestions[questionIndex].includes(speciality)) {
        count++;
        console.log("spcecial")
      }
  
      if (count > bestMatchCount) {
        console.log(count)
        console.log(bestMatchCount)
        bestMatchCount = count;
        bestMatchFungus = fungus;
      }
    })
    console.log("best is")
    console.log(bestMatchFungus)
    return bestMatchFungus
  }