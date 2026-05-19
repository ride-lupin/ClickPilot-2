import { cpSync, existsSync, mkdtempSync, rmSync, symlinkSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const safeRoot = mkdtempSync(join(tmpdir(), "clickpilot-vite-safe-root-"));
const command = process.argv[2];
const args = process.argv.slice(3);

if (!command) {
  console.error("Usage: node scripts/run-vite-safe-root.mjs <command> [...args]");
  process.exit(2);
}

for (const entry of ["src", "index.html", "package.json", "tsconfig.json", "tsconfig.node.json", "vite.config.ts"]) {
  cpSync(join(repoRoot, entry), join(safeRoot, entry), { recursive: true });
}

if (command === "vitest") {
  cpSync(join(repoRoot, "node_modules"), join(safeRoot, "node_modules"), {
    recursive: true,
    dereference: true,
  });
} else {
  symlinkSync(join(repoRoot, "node_modules"), join(safeRoot, "node_modules"), "dir");
}

const nodeArgs = ["--preserve-symlinks", "--preserve-symlinks-main"];
const binaryMap = {
  vite: ["node", [...nodeArgs, join(safeRoot, "node_modules", "vite", "bin", "vite.js")]],
  vitest: ["node", [...nodeArgs, join(safeRoot, "node_modules", "vitest", "vitest.mjs")]],
};
const mapped = binaryMap[command];
const binary = join(safeRoot, "node_modules", ".bin", command);
const executable = mapped ? mapped[0] : existsSync(binary) ? binary : command;
const executableArgs = mapped ? [...mapped[1], ...args] : args;
const result = spawnSync(executable, executableArgs, {
  cwd: safeRoot,
  stdio: "inherit",
  shell: process.platform === "win32",
  env: { ...process.env, CLICKPILOT_REAL_ROOT: repoRoot },
});

if (command === "vite" && args.includes("build") && existsSync(join(safeRoot, "dist"))) {
  rmSync(join(repoRoot, "dist"), { recursive: true, force: true });
  cpSync(join(safeRoot, "dist"), join(repoRoot, "dist"), { recursive: true });
}

process.exit(result.status ?? 1);
