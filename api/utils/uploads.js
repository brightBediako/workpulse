import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Ensure upload folders exist (also used at app boot). */
export function ensureUploadDirs() {
  const root = path.join(__dirname, "..", "uploads");
  const verification = path.join(root, "verification");
  const covers = path.join(root, "covers");
  for (const dir of [root, verification, covers]) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  }
  return root;
}
