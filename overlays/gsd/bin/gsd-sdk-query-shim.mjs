#!/usr/bin/env node
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const sdkDist = process.env.ALLOY_GSD_SDK_DIST
  ? resolve(process.env.ALLOY_GSD_SDK_DIST)
  : resolve(here, "..", "vendor", "gsd-opencode", "1.38.5", "sdk", "dist");
const gsdToolsPath = process.env.ALLOY_GSD_TOOLS
  ? resolve(process.env.ALLOY_GSD_TOOLS)
  : resolve(here, "..", "vendor", "gsd-opencode", "1.38.5", "get-shit-done", "bin", "gsd-tools.cjs");

const usage = `
Usage: gsd-sdk query <command> [args] [--project-dir <dir>] [--ws <name>] [--pick <field>]

OpenCode Alloy ships a lightweight project-local GSD query shim. It supports
GSD state/query helpers without vendoring the upstream SDK node_modules tree.
Use vendored GSD commands in OpenCode for workflow execution.
`.trim();

function fail(message, code = 1) {
  console.error(`Error: ${message}`);
  process.exitCode = code;
}

function dottedCommandToCjsArgv(command, args) {
  return command.includes(".") ? [...command.split("."), ...args] : [command, ...args];
}

function runGsdTools(projectDir, command, args, ws) {
  const fullArgs = [gsdToolsPath, ...dottedCommandToCjsArgv(command, args)];
  if (ws) {
    fullArgs.push("--ws", ws);
  }
  return new Promise((resolvePromise, reject) => {
    execFile(
      process.execPath,
      fullArgs,
      { cwd: projectDir, maxBuffer: 10 * 1024 * 1024, env: { ...process.env } },
      (error, stdout, stderr) => {
        if (error) {
          error.stderr = stderr;
          reject(error);
          return;
        }
        resolvePromise({
          stdout: stdout?.toString() ?? "",
          stderr: stderr?.toString() ?? "",
        });
      },
    );
  });
}

function parseArgs(argv) {
  let projectDir = process.cwd();
  let ws;
  let pick;
  const queryArgs = [];
  let command;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--project-dir" && argv[i + 1]) {
      projectDir = resolve(argv[i + 1]);
      i += 1;
      continue;
    }
    if (arg === "--ws" && argv[i + 1]) {
      ws = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === "--pick" && argv[i + 1]) {
      pick = argv[i + 1];
      i += 1;
      continue;
    }
    if (!command) {
      command = arg;
    } else {
      queryArgs.push(arg);
    }
  }

  return { projectDir, ws, pick, command, queryArgs };
}

async function parseJsonOutput(raw, projectDir) {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }
  if (trimmed.startsWith("@file:")) {
    const rel = trimmed.slice(6).trim();
    return JSON.parse(await readFile(resolve(projectDir, rel), "utf-8"));
  }
  return JSON.parse(trimmed);
}

async function main(argv = process.argv.slice(2)) {
  if (argv.includes("-h") || argv.includes("--help")) {
    console.log(usage);
    return;
  }
  if (argv.includes("-v") || argv.includes("--version")) {
    console.log("gsd-sdk alloy-query-shim for gsd-opencode 1.38.5");
    return;
  }
  if (argv[0] !== "query") {
    fail('This Alloy shim supports "gsd-sdk query" only. Use vendored /gsd-* OpenCode commands for workflow execution.');
    return;
  }
  if (!existsSync(sdkDist)) {
    fail(`Missing vendored GSD SDK dist: ${sdkDist}`);
    return;
  }

  const { projectDir, ws, pick, command, queryArgs } = parseArgs(argv.slice(1));
  if (!command) {
    fail('"gsd-sdk query" requires a command', 10);
    return;
  }

  const [
    { createRegistry, extractField },
    { resolveQueryArgv },
    { normalizeQueryCommand },
    { findProjectRoot },
  ] = await Promise.all([
    import(pathToFileURL(join(sdkDist, "query", "index.js")).href),
    import(pathToFileURL(join(sdkDist, "query", "registry.js")).href),
    import(pathToFileURL(join(sdkDist, "query", "normalize-query-command.js")).href),
    import(pathToFileURL(join(sdkDist, "query", "helpers.js")).href),
  ]);

  const actualProjectDir = findProjectRoot(projectDir);
  const [normalizedCommand, normalizedArgs] = normalizeQueryCommand(command, queryArgs);
  const registry = createRegistry();
  const matched = resolveQueryArgv([normalizedCommand, ...normalizedArgs], registry);

  try {
    let output;
    if (matched) {
      const result = await registry.dispatch(matched.cmd, matched.args, actualProjectDir, ws);
      output = result.data;
    } else {
      if (!existsSync(gsdToolsPath)) {
        fail(`No native query handler and missing gsd-tools fallback: ${gsdToolsPath}`);
        return;
      }
      const { stdout, stderr } = await runGsdTools(actualProjectDir, normalizedCommand, normalizedArgs, ws);
      if (stderr.trim()) {
        console.error(stderr.trimEnd());
      }
      output = await parseJsonOutput(stdout, actualProjectDir);
    }

    if (pick) {
      output = extractField(output, pick);
    }
    console.log(JSON.stringify(output, null, 2));
  } catch (error) {
    fail(error instanceof Error ? error.message : String(error));
  }
}

main();
