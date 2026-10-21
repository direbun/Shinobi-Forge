import { build } from "esbuild";
import { copyFile, mkdir, readFile, rm, writeFile } from "node:fs/promises";

await rm("dist", { recursive: true, force: true });
await mkdir("dist", { recursive: true });

let minified = true;
try {
  await build({
    entryPoints: ["app.js"],
    outfile: "dist/app.js",
    bundle: true,
    minify: true,
    sourcemap: false,
    target: ["es2022"],
    legalComments: "none",
  });

  await build({
    entryPoints: ["styles.css"],
    outfile: "dist/styles.css",
    bundle: true,
    minify: true,
    sourcemap: false,
    legalComments: "none",
  });
} catch (error) {
  if (!["EPERM", "ENOENT"].includes(error?.code)) throw error;
  minified = false;
  await copyFile("app.js", "dist/app.js");
  await copyFile("styles.css", "dist/styles.css");
}

const html = (await readFile("index.html", "utf8"))
  .replace(/app\.js\?[^"']+/g, "app.js")
  .replace(/styles\.css\?[^"']+/g, "styles.css");
await writeFile("dist/index.html", html, "utf8");

console.log(minified
  ? "Built minified frontend in dist/ with source maps disabled."
  : "Built frontend in dist/ without minification because subprocess execution is restricted.");
