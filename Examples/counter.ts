import { assign, createActor, setup } from "xstate";

export function setupCounter(element: HTMLButtonElement) {
  element.innerHTML = `count is ${actor.getSnapshot().context.count}`;
  element.addEventListener("click", () => {
    actor.send({ type: "INC" });
    element.innerHTML = `count is ${actor.getSnapshot().context.count}`;
  });
}

const machine = setup({}).createMachine({
  /** @xstate-layout N4IgpgJg5mDOIC5QAoC2BDAxgCwJYDswBKAOgGEB7AV3wBcBiASQDkyBtABgF1FQAHCrFy1cFfLxAAPRABYAzCQ4BOAIwzVAdgAcAVgBsqpUoA0IAJ6ItKknL06ZKgEwalMrba1KAvj9P4KEHASaFh4hEQSAkIiYhLSCAC0MiRKHLppjmpyaRwcGqYWiTopRqVlZXK+ICE4BMTk1HSRgsKi4khSsvnmiCpajiQqanpaemquOhrOPj5AA */
  context: { count: 0 },
  initial: "Count",
  states: {
    Count: {
      on: {
        INC: {
          actions: assign(({ context }) => {
            return { count: context.count + 1 };
          }),
        },
      },
    },
  },
});

const actor = createActor(machine).start();

actor.subscribe((state) => {
  console.group("State update");
  console.log("State value:", state.value);
  console.log("State context:", state.context);
  console.groupEnd();
});
