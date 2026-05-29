import { rm, readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(rootDir, "..");

await rm(join(projectRoot, "dist"), { recursive: true, force: true }).catch(() => {});
await rm(join(projectRoot, "web-ext-artifacts"), { recursive: true, force: true }).catch(() => {});
await rm(join(projectRoot, "coverage"), { recursive: true, force: true }).catch(() => {});

// Clean root zip and xpi files
try {
  const files = await readdir(projectRoot);
  for (const file of files) {
    if ((file.startsWith("tabula-") && file.endsWith(".zip")) || file.endsWith(".xpi")) {
      await rm(join(projectRoot, file), { force: true }).catch(() => {});
    }
  }
} catch (error) {
  console.warn("Failed to read root directory for cleaning zips/xpis", error);
}
