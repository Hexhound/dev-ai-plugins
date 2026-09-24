#!/usr/bin/env node
// Lists what changed between two unzipped design exports, so an export the
// tool had not finished yet is caught before it is reviewed.
// Usage: node compare-exports.mjs <previous-folder> <new-folder>
import fs from "node:fs";
import path from "node:path";

function files(root) {
  const found = new Map();
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else found.set(path.relative(root, full), fs.readFileSync(full));
    }
  };
  walk(root);
  return found;
}

const [before, after] = process.argv.slice(2).map((p) => files(path.resolve(p)));
const added = [...after.keys()].filter((f) => !before.has(f));
const removed = [...before.keys()].filter((f) => !after.has(f));
const changed = [...after.keys()].filter(
  (f) => before.has(f) && !before.get(f).equals(after.get(f)),
);

for (const [label, list] of [["added", added], ["removed", removed], ["changed", changed]]) {
  for (const f of list.sort()) console.log(`${label}\t${f}`);
}
if (added.length + removed.length + changed.length === 0) {
  console.log("identical: the tool had probably not finished; ask for a fresh export");
  process.exitCode = 1;
}
