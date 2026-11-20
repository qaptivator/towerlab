import { readFileSync } from "node:fs";

const file = process.argv[2];
const roots = JSON.parse(readFileSync(file, "utf8"));

function findNamed(node, pred, out = []) {
  if (pred(node)) out.push(node);
  for (const child of node.children ?? []) findNamed(child, pred, out);
  return out;
}

function attrs(node) {
  return node.properties?.Attributes?.Attributes ?? {};
}

function attrSummary(bag) {
  const keys = Object.keys(bag);
  return keys
    .slice(0, 24)
    .map((key) => {
      const tagged = bag[key];
      const kind = tagged && typeof tagged === "object" ? Object.keys(tagged)[0] : "?";
      const value = tagged?.[kind];
      const shown = typeof value === "string" ? JSON.stringify(value.slice(0, 40)) : JSON.stringify(value);
      return `${key}:${kind}=${shown}`;
    })
    .join(", ");
}

function childBrief(node) {
  return (node.children ?? [])
    .map((child) => `${child.className}:${child.name}`)
    .join(", ");
}

const all = [];
for (const root of roots) findNamed(root, () => true, all);

const clientFolders = all.filter((node) => {
  const name = node.name.toLowerCase().replace(/[\s_-]+/g, "");
  return name === "clientsidedobjects" || name === "clientparts" || name === "clientobjects";
});

console.log(`# ${file}`);
console.log(`client folders: ${clientFolders.map((node) => `${node.className} ${node.name} (${node.children.length})`).join(" | ")}`);

for (const folder of clientFolders) {
  const counts = new Map();
  for (const child of folder.children ?? []) {
    const configs = [];
    const values = [];
    const scripts = [];
    const walk = (node) => {
      if (node.className === "Configuration") configs.push(node.name);
      if (node.className.endsWith("Value")) values.push(`${node.className}:${node.name}`);
      if (node.className.endsWith("Script")) scripts.push(`${node.className}:${node.name}`);
      for (const nested of node.children ?? []) walk(nested);
    };
    walk(child);
    const key = `${child.className} ${child.name}`;
    const entry = counts.get(key) ?? { count: 0, configs: new Map(), values: new Map(), scripts: new Map(), sampleAttrs: "" };
    entry.count += 1;
    for (const name of configs) entry.configs.set(name, (entry.configs.get(name) ?? 0) + 1);
    for (const name of values) entry.values.set(name, (entry.values.get(name) ?? 0) + 1);
    for (const name of scripts) entry.scripts.set(name, (entry.scripts.get(name) ?? 0) + 1);
    if (!entry.sampleAttrs) {
      const own = attrSummary(attrs(child));
      const configNode = (child.children ?? []).find((item) => item.className === "Configuration");
      entry.sampleAttrs = [own && `self[${own}]`, configNode && `${configNode.name}[${attrSummary(attrs(configNode))}]`]
        .filter(Boolean)
        .join(" ");
      entry.sampleChildren = childBrief(child);
    }
    counts.set(key, entry);
  }

  console.log(`\n## ${folder.name}`);
  for (const [key, entry] of [...counts.entries()].sort((a, b) => b[1].count - a[1].count)) {
    const top = (map) =>
      [...map.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([name, count]) => `${name}×${count}`)
        .join(", ");
    console.log(`${entry.count}\t${key}`);
    if (entry.configs.size) console.log(`    configs: ${top(entry.configs)}`);
    if (entry.values.size) console.log(`    values: ${top(entry.values)}`);
    if (entry.scripts.size) console.log(`    scripts: ${top(entry.scripts)}`);
    if (entry.sampleChildren) console.log(`    children: ${entry.sampleChildren}`);
    if (entry.sampleAttrs) console.log(`    attrs: ${entry.sampleAttrs}`);
  }
}

const repos = all.filter((node) => node.name === "Repository" || node.name === "KitSettings");
console.log("\n## repository");
for (const repo of repos) {
  console.log(`${repo.className} ${repo.name} children=${(repo.children ?? []).length}`);
  for (const child of (repo.children ?? []).slice(0, 20)) {
    console.log(`  ${child.className} ${child.name} (${(child.children ?? []).length})`);
  }
}
