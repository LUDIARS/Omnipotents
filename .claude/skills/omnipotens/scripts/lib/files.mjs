import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { extname, relative, resolve, sep } from "node:path";

export function portablePath(value) {
  return value.split(sep).join("/");
}

export async function discoverFiles(root, extensions) {
  const wanted = new Set(extensions.map((extension) => extension.toLowerCase()));
  const found = [];

  async function visit(directory) {
    const entries = await readdir(directory, { withFileTypes: true });
    entries.sort((left, right) => left.name.localeCompare(right.name));
    for (const entry of entries) {
      if (entry.name === ".git" || entry.name === "node_modules") continue;
      const fullPath = resolve(directory, entry.name);
      if (entry.isDirectory()) await visit(fullPath);
      else if (wanted.has(extname(entry.name).toLowerCase())) found.push(fullPath);
    }
  }

  await visit(resolve(root));
  return found;
}

export async function sha256(filePath) {
  const content = await readFile(filePath);
  return createHash("sha256").update(content).digest("hex");
}

export function relativePortable(from, target) {
  return portablePath(relative(resolve(from), resolve(target)));
}
