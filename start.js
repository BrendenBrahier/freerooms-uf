#!/usr/bin/env node

const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

const repoRoot = __dirname;

function findProjectRoot() {
  return repoRoot;
}

const projectRoot = findProjectRoot();
if (!projectRoot) {
  console.error("[error] Unable to locate backend/frontend directories.");
  console.error("        Expected to find them in this folder.");
  process.exit(1);
}

const backendDir = path.join(projectRoot, "backend");
const frontendDir = path.join(projectRoot, "frontend");
const useShell = process.platform === "win32";
const npmCmd = "npm";

function assertDirExists(dir, label) {
  if (!fs.existsSync(dir)) {
    console.error(`[error] Unable to find ${label} directory at ${dir}.`);
    console.error("        Make sure you are running this script from the repository root.");
    process.exit(1);
  }
}

function startService(label, cwd) {
  console.log(`\n[start] Starting ${label}...`);
  const child = spawn(npmCmd, ["run", "dev"], {
    cwd,
    stdio: "inherit",
    shell: useShell,
  });

  child.on("exit", (code, signal) => {
    const status = signal ? `signal ${signal}` : `code ${code}`;
    console.log(`\n[status] ${label} exited with ${status}.`);
    shutdown(code ?? 0);
  });

  return child;
}

const children = [];
let shuttingDown = false;

function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;

  for (const child of children) {
    if (!child.killed) {
      child.kill();
    }
  }

  setTimeout(() => process.exit(code), 500);
}

process.on("SIGINT", () => {
  console.log("\n[signal] Received SIGINT. Stopping services...");
  shutdown(0);
});

process.on("SIGTERM", () => {
  console.log("\n[signal] Received SIGTERM. Stopping services...");
  shutdown(0);
});

function main() {
  assertDirExists(projectRoot, "project");
  assertDirExists(backendDir, "backend");
  assertDirExists(frontendDir, "frontend");

  children.push(startService("backend (http://localhost:4000)", backendDir));
  children.push(startService("frontend (http://localhost:5173)", frontendDir));
}

main();
