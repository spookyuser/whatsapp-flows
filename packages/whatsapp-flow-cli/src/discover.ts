import { readdir } from "node:fs/promises";
import path from "node:path";

/** Recursively find screen files (*.tsx / *.jsx) under a screens directory.
 * Returns absolute paths, sorted for deterministic output. */
export async function discoverScreens(screensDir: string): Promise<string[]> {
  const out: string[] = [];
  async function walk(dir: string): Promise<void> {
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) await walk(full);
      else if (/\.(tsx|jsx)$/.test(entry.name)) out.push(full);
    }
  }
  await walk(screensDir);
  return out.sort();
}
