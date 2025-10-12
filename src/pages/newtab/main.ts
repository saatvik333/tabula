import { ClockApp } from "$src/app/clock-app";

const container = document.getElementById("app");

if (!container) {
  throw new Error("Missing #app container element");
}

const app = new ClockApp(container);
app.start();
