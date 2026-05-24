import { type AuthoringNode, FlowCompileError, isAuthoringNode } from "whatsapp-flow-core";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** Component → the prop on it that carries a single base64 image. */
const IMAGE_PROP: Record<string, string> = {
  Image: "src",
  CarouselImage: "src",
  Option: "image",
  NavItem: "image",
};

const IMAGE_EXTENSION = /\.(?:png|jpe?g|gif|webp|bmp|svg)$/i;

/** True when a src looks like a file path or URL we should encode, as opposed to
 * an already-base64 blob or a `${...}` reference, which we leave untouched.
 * Keyed off the scheme or a trailing image extension — base64 (e.g. the JPEG
 * `/9j/...`) never ends in `.png`/`.jpg`, so it is never misread as a path. */
function isImageSource(value: string): boolean {
  if (/^https?:\/\//i.test(value)) return true;
  if (value.startsWith("file://")) return true;
  const withoutQuery = value.split(/[?#]/)[0] ?? value;
  return IMAGE_EXTENSION.test(withoutQuery);
}

async function encode(src: string, baseDir: string, route: string): Promise<string> {
  if (/^https?:\/\//i.test(src)) {
    let res: Response;
    try {
      res = await fetch(src);
    } catch (e) {
      throw new FlowCompileError(
        `Could not fetch image "${src}" on screen "${route}": ${(e as Error).message}`,
        { route },
      );
    }
    if (!res.ok) {
      throw new FlowCompileError(
        `Could not fetch image "${src}" on screen "${route}": ${res.status} ${res.statusText}`,
        { route },
      );
    }
    return Buffer.from(await res.arrayBuffer()).toString("base64");
  }
  const file = src.startsWith("file://") ? fileURLToPath(src) : path.resolve(baseDir, src);
  try {
    return (await readFile(file)).toString("base64");
  } catch {
    throw new FlowCompileError(
      `Could not read image "${src}" on screen "${route}" (resolved to ${file}).`,
      { route },
    );
  }
}

/** Walk a rendered screen tree and replace image path/URL sources with base64,
 * in place. Relative paths resolve against `baseDir` (the screen file's
 * directory). Already-base64 strings and `${...}` references pass through. */
export async function resolveImages(
  root: unknown,
  baseDir: string,
  route: string,
): Promise<void> {
  if (!isAuthoringNode(root)) return;

  const jobs: Promise<void>[] = [];
  const visit = (n: AuthoringNode): void => {
    const prop = IMAGE_PROP[n.component];
    if (prop !== undefined) {
      const value = n.props[prop];
      if (typeof value === "string" && isImageSource(value)) {
        jobs.push(
          encode(value, baseDir, route).then((b64) => {
            n.props[prop] = b64;
          }),
        );
      }
    }
    for (const child of n.children) visit(child);
  };
  visit(root);
  await Promise.all(jobs);
}
