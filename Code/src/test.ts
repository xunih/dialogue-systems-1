import { Fungus } from "./types";
import fungiData from "./fungiData.json"
import { randomQuestions } from "./fixedVariables";
var c = "brown"
var s = "long"
var size = "no"
var spe = "self-digest"
var fungi: Fungus[] = fungiData;
var bestMatchCount: number = 0;
var bestMatchFungus: Fungus | null = null;
fungi.forEach((fungus) => {
    console.log("counting!!!")
    let count: number = 0;
    console.log(fungus.name)
    if (fungus.color.includes(c)) {
        count++;
        console.log(fungus.color)
        console.log(count)
    }
    if (fungus.shape.includes(s)) {
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
    if (randomQuestions[2].includes(spe)) {
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