/**
 * Summarize an exported instance tree JSON from the inspector.
 * Usage: node scripts/inspect-tree.mjs .dev/some.tree.json
 */
import { readFileSync } from "node:fs";

const file = process.argv[2];
if (!file) {
  console.error("usage: node scripts/inspect-tree.mjs <tree.json>");
  process.exit(1);
}

const roots = JSON.parse(readFileSync(file, "utf8"));
const classes = new Map();
const valueNames = new Map();
const configPaths = [];
const interesting = [];

function walk(node, path, depth) {
  classes.set(node.className, (classes.get(node.className) ?? 0) + 1);
  const here = `${path}/${node.name}`;

  if (
    node.className === "StringValue" ||
    node.className === "NumberValue" ||
    node.className === "IntValue" ||
    node.className === "BoolValue" ||
    node.className === "ObjectValue" ||
    node.className === "Color3Value" ||
    node.className === "Vector3Value" ||
    node.className === "CFrameValue" ||
    node.className === "BrickColorValue"
  ) {
    const key = `${node.className}:${node.name}`;
    const entry = valueNames.get(key) ?? { count: 0, sample: here, value: undefined };
    entry.count += 1;
    if (entry.value === undefined) entry.value = scalar(node);
    valueNames.set(key, entry);
  }

  if (node.className === "Configuration") {
    const attrs = node.properties?.Attributes?.Attributes ?? {};
    const attrKeys = Object.keys(attrs);
    const childSummary = (node.children ?? []).map((child) => `${child.className}:${child.name}`);
    configPaths.push({
      path: here,
      attrKeys,
      children: childSummary.slice(0, 40),
      childCount: childSummary.length,
    });
  }

  const name = node.name.toLowerCase();
  if (
    depth <= 6 &&
    (name.includes("obby") ||
      name.includes("client") ||
      name.includes("frame") ||
      name.includes("script") ||
      name.includes("tower") ||
      name.includes("kit") ||
      name.includes("config") ||
      node.className === "Configuration" ||
      node.className.endsWith("Script"))
  ) {
    interesting.push(`${"  ".repeat(depth)}${node.className} ${node.name} (${(node.children ?? []).length})`);
  }

  for (const child of node.children ?? []) walk(child, here, depth + 1);
}

function scalar(node) {
  const props = node.properties ?? {};
  for (const key of ["Value", "Source"]) {
    const tagged = props[key];
    if (!tagged || typeof tagged !== "object") continue;
    const inner = Object.values(tagged)[0];
    if (typeof inner === "string") return inner.slice(0, 80);
    if (typeof inner === "number" || typeof inner === "boolean") return inner;
  }
  return null;
}

function outline(node, depth, limit) {
  if (depth > limit) return;
  const kids = node.children ?? [];
  console.log(`${"  ".repeat(depth)}${node.className} ${JSON.stringify(node.name)} x${kids.length}`);
  const shown = kids.slice(0, depth === 0 ? 30 : 12);
  for (const child of shown) outline(child, depth + 1, limit);
  if (kids.length > shown.length) {
    console.log(`${"  ".repeat(depth + 1)}… ${kids.length - shown.length} more`);
  }
}

for (const root of roots) walk(root, "", 0);

console.log(`\n# ${file}`);
console.log("\n## outline");
for (const root of roots) outline(root, 0, 3);

console.log("\n## classes");
for (const [name, count] of [...classes.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`${count}\t${name}`);
}

console.log("\n## value objects");
const values = [...valueNames.entries()].sort((a, b) => b[1].count - a[1].count);
for (const [key, entry] of values.slice(0, 80)) {
  console.log(`${entry.count}\t${key}\t${JSON.stringify(entry.value)}\t${entry.sample}`);
}
console.log(`value kinds: ${values.length}`);

console.log("\n## configurations");
for (const config of configPaths.slice(0, 30)) {
  console.log(config.path);
  console.log(`  attrs(${config.attrKeys.length}): ${config.attrKeys.slice(0, 40).join(", ")}`);
  console.log(`  children(${config.childCount}): ${config.children.join(", ")}`);
}
console.log(`configuration count: ${configPaths.length}`);

console.log("\n## named hits");
for (const line of interesting.slice(0, 200)) console.log(line);
console.log(`named hits: ${interesting.length}`);
