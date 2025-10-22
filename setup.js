#!/usr/bin/env node

const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

const repoRoot = __dirname;

const projectRoot = repoRoot;
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

function runCommand(label, cwd, args) {
  return new Promise((resolve, reject) => {
    console.log(`\n[setup] ${label}`);
    const child = spawn(npmCmd, args, {
      cwd,
      stdio: "inherit",
      shell: useShell,
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Command "${npmCmd} ${args.join(" ")}" failed in ${cwd}`));
      }
    });
  });
}

async function main() {
  assertDirExists(projectRoot, "project");
  assertDirExists(backendDir, "backend");
  assertDirExists(frontendDir, "frontend");

  try {
    await runCommand("Installing backend dependencies...", backendDir, ["install"]);
    await runCommand("Installing frontend dependencies...", frontendDir, ["install"]);
    console.log("\n[done] Setup complete. You can now run `node start.js` to launch both servers.");
  } catch (err) {
    console.error(`\n[error] Setup failed: ${err.message}`);
    process.exit(1);
  }
}

main();
