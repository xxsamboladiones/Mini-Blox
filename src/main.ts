import "./styles.css";
import { App } from "./app/App";

const root = document.querySelector<HTMLElement>("#app");

if (!root) {
  throw new Error("Missing #app root element.");
}

const app = new App(root);
app.start();
