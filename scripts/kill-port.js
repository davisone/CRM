#!/usr/bin/env node

const { execSync } = require("node:child_process");

const ports = process.argv.slice(2).map((p) => Number(p)).filter(Boolean);
if (ports.length === 0) {
  process.exit(0);
}

function killPort(port) {
  try {
    const output = execSync(`lsof -ti:${port}`, { stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim();
    if (!output) return;
    const pids = output.split(/\s+/).filter(Boolean);
    for (const pid of pids) {
      try {
        execSync(`kill -9 ${pid}`, { stdio: "ignore" });
      } catch {
        // ignore
      }
    }
  } catch {
    // ignore
  }
}

for (const port of ports) {
  killPort(port);
}
