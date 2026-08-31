/**
 * Is the harness still the app, and nothing else?
 *
 * The harness exists so `verify` can run the app's own drawing code in Node.
 * That works only while those modules stay free of the device: no React, no
 * react-native, no Expo module. TypeScript has no opinion about it, it compiles
 * an import Node could never resolve without a word, and the failure then
 * arrives much later as a missing module in the middle of a verification run.
 *
 * So the emitted JavaScript is read back, and anything it requires that is not
 * Skia (which the harness shims) or another harness module fails the build,
 * with the file that did it.
 */
const fs = require("fs");
const path = require("path");

const HARNESS = path.join(__dirname, "..", ".harness");
/** The one import the harness knows how to answer, by handing over CanvasKit. */
const SHIMMED = "@shopify/react-native-skia";

function files(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? files(p) : p.endsWith(".js") ? [p] : [];
  });
}

const bad = [];
for (const file of files(HARNESS)) {
  const source = fs.readFileSync(file, "utf8");
  for (const [, name] of source.matchAll(/require\("([^"]+)"\)/g)) {
    if (name.startsWith(".") || name === SHIMMED) {
      continue;
    }
    bad.push(`${path.relative(HARNESS, file)} requires ${name}`);
  }
}

if (bad.length > 0) {
  console.error(
    `\n  The harness has to be loadable by Node, and this is not:\n` +
      bad.map((b) => `    ${b}`).join("\n") +
      `\n\n  Either the module belongs to the app rather than to the drawing,` +
      `\n  or tsconfig.harness.json needs to say so.\n`,
  );
  process.exit(1);
}
