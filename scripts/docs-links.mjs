import { existsSync, readFileSync, realpathSync, statSync } from "node:fs";
import path from "node:path";

function headings(text) {
  const seen = new Map();
  const ids = new Set();
  for (const match of text.matchAll(/^#{1,6}\s+(.+?)\s*#*$/gm)) {
    const base = match[1].toLowerCase().replace(/[^\p{L}\p{N}\s_-]/gu, "").replace(/\s/g, "-");
    const count = seen.get(base) ?? 0;
    ids.add(count ? `${base}-${count}` : base);
    seen.set(base, count + 1);
  }
  return ids;
}

// Repository docs use inline Markdown links and reference definitions. Ignore
// fenced examples; validate local paths and Markdown heading fragments offline.
export function verifyDocumentationLinks(root, files) {
  const canonicalRoot = realpathSync(root);
  let checked = 0;
  for (const file of files) {
    const source = path.resolve(root, file);
    const content = readFileSync(source, "utf8").replace(/^(```|~~~)[^\n]*\n[\s\S]*?^\1[^\n]*$/gm, "");
    const targets = [
      ...Array.from(content.matchAll(/\[[^\]\n]*\]\(\s*(<[^>\n]+>|[^\s)]+)(?:\s+"[^"\n]*")?\s*\)/g), (match) => match[1]),
      ...Array.from(content.matchAll(/^\s*\[[^\]\n]+\]:\s*(<[^>\n]+>|[^\s]+)(?:\s+"[^"\n]*")?\s*$/gm), (match) => match[1]),
    ];
    for (const raw of targets) {
      const target = raw.replace(/^<|>$/g, "");
      if (/^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(target)) continue;
      const [local, fragment] = target.split("#", 2);
      const relative = decodeURIComponent(local.split("?", 1)[0]);
      const resolved = relative ? path.resolve(path.dirname(source), relative) : source;
      if (!existsSync(resolved)) throw new Error(`Broken documentation link in ${file}: ${target}`);
      const canonicalTarget = realpathSync(resolved);
      const boundary = path.relative(canonicalRoot, canonicalTarget);
      if (boundary === ".." || boundary.startsWith(`..${path.sep}`) || path.isAbsolute(boundary)) {
        throw new Error(`Documentation link leaves repository in ${file}: ${target}`);
      }
      if (fragment && path.extname(resolved) === ".md" && statSync(resolved).isFile()) {
        if (!headings(readFileSync(resolved, "utf8")).has(decodeURIComponent(fragment))) {
          throw new Error(`Missing documentation heading in ${file}: ${target}`);
        }
      }
      checked += 1;
    }
  }
  return checked;
}
