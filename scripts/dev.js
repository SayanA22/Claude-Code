#!/usr/bin/env node
/**
 * Runs the API server and the Vite dev server together, with no extra
 * dependency on something like `concurrently`.
 *
 * Ctrl-C stops both.
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

if (!fs.existsSync(path.join(root, ".env"))) {
  console.error("\n  No .env file found.\n");
  console.error("  cp .env.example .env    then add your GitHub token.\n");
  process.exit(1);
}

const children = [];

function run(name, command, args, color) {
  const child = spawn(command, args, { cwd: root, env: process.env });
  const prefix = `\x1b[${color}m[${name}]\x1b[0m`;

  const pipe = (stream, target) => {
    let buffer = "";
    stream.on("data", (chunk) => {
      buffer += chunk.toString();
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) target.write(`${prefix} ${line}\n`);
    });
  };

  pipe(child.stdout, process.stdout);
  pipe(child.stderr, process.stderr);

  child.on("exit", (code) => {
    if (code !== 0 && code !== null) {
      console.error(`${prefix} exited with code ${code}`);
      shutdown(code);
    }
  });

  children.push(child);
  return child;
}

function shutdown(code = 0) {
  for (const child of children) {
    if (!child.killed) child.kill("SIGTERM");
  }
  process.exit(code);
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

run("api", process.execPath, ["--env-file-if-exists=.env", "server/src/index.js"], "36");
run("web", "npm", ["run", "dev", "--workspace", "web", "--silent"], "35");

console.log("\n  Starting PR Radar. The UI will be at http://localhost:5173\n");
