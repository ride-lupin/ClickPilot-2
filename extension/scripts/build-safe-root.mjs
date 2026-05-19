import { cpSync, mkdtempSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";

const extensionRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const safeRoot = mkdtempSync(join(tmpdir(), "clickpilot-extension-safe-root-"));


for (const entry of ["src", "scripts", "manifest.json", "package.json", "tsconfig.json", "vite.config.ts"]) {
  cpSync(join(extensionRoot, entry), join(safeRoot, entry), { recursive: true });
}
cpSync(join(extensionRoot, "node_modules"), join(safeRoot, "node_modules"), {
  recursive: true,
  dereference: true,
});

const result = spawnSync("node", [join(safeRoot, "node_modules", "vite", "bin", "vite.js"), "build"], {
  cwd: safeRoot,
  stdio: "inherit",
});

if (result.status === 0) {
  spawnSync("node", [join(safeRoot, "scripts", "copy-manifest.mjs")], {
    cwd: safeRoot,
    stdio: "inherit",
  });
  rmSync(join(extensionRoot, "dist"), { recursive: true, force: true });
  cpSync(join(safeRoot, "dist"), join(extensionRoot, "dist"), { recursive: true });
}

process.exit(result.status ?? 1);
