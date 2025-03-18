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
    for (let fungus in fungi){
      console.log(fungus)
    }
    fungi.forEach((fungus) => {
      console.log("counting!!!")
      let count: number = 0;
      console.log(fungus.name)
      if (fungus.color.includes(color)) {
        count++;
        console.log(fungus.color)
        console.log(count)
      }
      if (fungus.shape.includes(shape)) {
        count++;
        console.log(fungus.shape)
        console.log(count)
      }
      if (size === "yes") {
        if (fungus.size === "tall") {
          count++;
          console.log(fungus.size)
          console.log(count)
        }
      } else if (size === "no") {
        if (fungus.size === "small") {
          count++;
          console.log(fungus.size)
          console.log(count)
        }
      }
      if (randomQuestions[questionIndex].includes(speciality)) {
        count++;
        console.log(fungus.special)
        console.log(count)
      }
  
      if (count > bestMatchCount) {
        console.log("look at me")
        console.log(count)
        
        bestMatchCount = count;
        console.log(bestMatchCount)
        bestMatchFungus = fungus;
        console.log(bestMatchFungus)
      }
    })
    console.log("best is")
    console.log(bestMatchFungus)
    return bestMatchFungus
  }