import { cpSync, mkdirSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../", import.meta.url));
const output = new URL("../.pages/", import.meta.url);
// Validate the absolute destination before replacing the generated artifact.
const destination = fileURLToPath(output);
if (destination !== `${root}.pages\\` && destination !== `${root}.pages/`)
  throw new Error("Unexpected Pages output path");
rmSync(destination, { recursive: true, force: true });
mkdirSync(output, { recursive: true });
cpSync(
  new URL("../dist/", import.meta.url),
  new URL("camera-lens-explorer/", output),
  { recursive: true },
);
cpSync(
  new URL("../pages/index.html", import.meta.url),
  new URL("index.html", output),
);
mkdirSync(new URL("assets/", output), { recursive: true });
cpSync(
  new URL("../docs/images/", import.meta.url),
  new URL("assets/", output),
  { recursive: true },
);
console.log(`Pages artifact prepared in ${root}.pages`);
