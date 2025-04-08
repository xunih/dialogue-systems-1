import "./style.css";
import typescriptLogo from "./typescript.svg";
import viteLogo from "/vite.svg";
import { setupButton } from "./dm.js";
import fungiData from "./fungiData.json"

document.querySelector<HTMLDivElement>("#app")!.innerHTML = `
  <div>
    <div class="card">
      <button id="counter" type="button"></button>
    </div>
    <div class="img">
      <div class="flip-card" onclick="this.classList.toggle('flipped')">
        <div class="flip-inner">
          <div class="flip-front">
            <img src="${fungiData[0].image}" alt="mushroom_nr1">
            <div class="number-overlay">${fungiData[0].nr}</div>
          </div>
          <div class="flip-back">
            <p>${fungiData[0].intro}</p>
          </div>
        </div>
      </div>
      <div class="flip-card" onclick="this.classList.toggle('flipped')">
        <div class="flip-inner">
          <div class="flip-front">
            <img src="${fungiData[1].image}" alt="mushroom_nr2">
            <div class="number-overlay">${fungiData[1].nr}</div>
          </div>
          <div class="flip-back">
            <p>${fungiData[1].intro}</p>
          </div>
        </div>
      </div>
      <div class="flip-card" onclick="this.classList.toggle('flipped')">
        <div class="flip-inner">
          <div class="flip-front">
            <img src="${fungiData[2].image}" alt="mushroom_nr3">
            <div class="number-overlay">${fungiData[2].nr}</div>
          </div>
          <div class="flip-back">
            <p>${fungiData[2].intro}</p>
          </div>
        </div>
      </div>
      <div class="flip-card" onclick="this.classList.toggle('flipped')">
        <div class="flip-inner">
          <div class="flip-front">
            <img src="${fungiData[3].image}" alt="mushroom_nr4">
            <div class="number-overlay">${fungiData[3].nr}</div>
          </div>
          <div class="flip-back">
            <p>${fungiData[3].intro}</p>
          </div>
        </div>
      </div>
      <div class="flip-card" onclick="this.classList.toggle('flipped')">
        <div class="flip-inner">
          <div class="flip-front">
            <img src="${fungiData[4].image}" alt="mushroom_nr5">
            <div class="number-overlay">${fungiData[4].nr}</div>
          </div>
          <div class="flip-back">
            <p>${fungiData[4].intro}</p>
          </div>
        </div>
      </div>
      <div class="flip-card" onclick="this.classList.toggle('flipped')">
        <div class="flip-inner">
          <div class="flip-front">
            <img src="${fungiData[5].image}" alt="mushroom_nr6">
            <div class="number-overlay">${fungiData[5].nr}</div>
          </div>
          <div class="flip-back">
            <p>${fungiData[5].intro}</p>
          </div>
        </div>
      </div>
    </div>
  </div>
`;


setupButton(document.querySelector<HTMLButtonElement>("#counter")!);
