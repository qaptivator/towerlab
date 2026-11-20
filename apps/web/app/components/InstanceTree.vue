<script setup lang="ts">
import type { RbxDocument, RbxNode } from "@towerlab/dom-schema";
import { indexNodes, isBasePart } from "@towerlab/kit-engine";

const props = defineProps<{
  document: RbxDocument;
  selectedId: string | null;
}>();

const emit = defineEmits<{
  select: [id: string];
}>();

const query = ref("");
const expanded = ref(new Set<string>());
const scrollTop = ref(0);
const viewport = ref<HTMLElement | null>(null);
const rowHeight = 32;
const overscan = 8;

const byId = computed(() => indexNodes(props.document));

watch(
  () => props.document,
  (document) => {
    const next = new Set<string>();
    for (const id of document.rootIds) next.add(id);
    expanded.value = next;
    query.value = "";
    scrollTop.value = 0;
  },
  { immediate: true },
);

interface FlatRow {
  id: string;
  depth: number;
  hasChildren: boolean;
  open: boolean;
}

const rows = computed<FlatRow[]>(() => {
  const list: FlatRow[] = [];
  const walk = (ids: string[], depth: number) => {
    for (const id of ids) {
      const node = byId.value.get(id);
      if (!node) continue;
      const hasChildren = node.childIds.length > 0;
      const open = expanded.value.has(id);
      list.push({ id, depth, hasChildren, open });
      if (hasChildren && open) walk(node.childIds, depth + 1);
    }
  };
  walk(props.document.rootIds, 0);
  return list;
});

const matches = computed(() => {
  const needle = query.value.trim().toLowerCase();
  if (!needle) return null;
  const found: RbxNode[] = [];
  let extra = false;
  for (const node of props.document.nodes) {
    if (node.name.toLowerCase().includes(needle) || node.className.toLowerCase().includes(needle)) {
      if (found.length >= 200) {
        extra = true;
        break;
      }
      found.push(node);
    }
  }
  return { found, extra };
});

const startIndex = computed(() => Math.max(0, Math.floor(scrollTop.value / rowHeight) - overscan));
const visibleCount = computed(() => Math.ceil(520 / rowHeight) + overscan * 2);
const visibleRows = computed(() => rows.value.slice(startIndex.value, startIndex.value + visibleCount.value));

function onScroll(event: Event) {
  scrollTop.value = (event.target as HTMLElement).scrollTop;
}

function toggle(id: string) {
  const next = new Set(expanded.value);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  expanded.value = next;
}

function nodeOf(id: string): RbxNode | undefined {
  return byId.value.get(id);
}

const FOLDER = "#E6C15A";
const PART = "#C8C8C8";
const MODEL = "#6EA8FE";
const SCRIPT = "#F4F4F5";
const LOCAL_SCRIPT = "#5B9DFF";
const MODULE_SCRIPT = "#C084FC";
const STUDIO_BLUE = "#5B9DFF";
const NEUTRAL = "#71717A";

const GUI_CLASSES = new Set([
  "Frame",
  "ScrollingFrame",
  "CanvasGroup",
  "TextLabel",
  "TextButton",
  "TextBox",
  "ImageLabel",
  "ImageButton",
  "ViewportFrame",
  "VideoFrame",
]);

const EFFECT_CLASSES = new Set(["ParticleEmitter", "Beam", "Trail", "Fire", "Smoke", "Sparkles"]);

function isGui(className: string): boolean {
  return className.endsWith("Gui") || className.startsWith("UI") || GUI_CLASSES.has(className);
}

function iconFor(className: string): { name: string; color: string } {
  if (className === "Folder") return { name: "folder", color: FOLDER };
  if (className === "Model") return { name: "account_tree", color: MODEL };
  if (className === "ModuleScript") return { name: "integration_instructions", color: MODULE_SCRIPT };
  if (className === "LocalScript") return { name: "code", color: LOCAL_SCRIPT };
  if (className === "Script") return { name: "description", color: SCRIPT };
  if (className === "Attachment" || EFFECT_CLASSES.has(className)) return { name: "adjust", color: STUDIO_BLUE };
  if (isGui(className)) return { name: "web_asset", color: STUDIO_BLUE };
  if (className === "Configuration") return { name: "settings", color: PART };
  if (isBasePart(className)) return { name: "category", color: PART };
  return { name: "data_object", color: NEUTRAL };
}
</script>

<template>
  <section class="flex min-h-0 flex-col rounded-xl bg-subtle">
    <div class="border-b border-border-subtle p-3">
      <label class="sr-only" for="tree-search">Search instances</label>
      <input
        id="tree-search"
        v-model="query"
        class="w-full rounded-lg border border-border-subtle bg-canvas px-3 py-2 font-mono text-sm text-ink outline-none placeholder:text-dim focus:border-border-prominent"
        type="search"
        placeholder="Search name or class"
        autocomplete="off"
      />
    </div>

    <div v-if="matches" class="max-h-[32rem] overflow-auto p-2">
      <p v-if="matches.found.length === 0" class="px-2 py-6 text-center text-sm text-dim">No matching instances.</p>
      <button
        v-for="node in matches.found"
        :key="node.id"
        class="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-raised"
        :class="selectedId === node.id ? 'bg-raised text-ink' : 'text-muted'"
        type="button"
        @click="emit('select', node.id)"
      >
        <span class="material-symbols-outlined text-[16px]" :style="{ color: iconFor(node.className).color }">{{ iconFor(node.className).name }}</span>
        <span class="truncate font-mono text-sm">{{ node.name }}</span>
        <span class="ml-auto shrink-0 font-mono text-[11px] text-dim">{{ node.className }}</span>
      </button>
      <p v-if="matches.extra" class="px-2 py-2 text-xs text-dim">Showing the first 200 matches. Narrow the search to see more.</p>
    </div>

    <div v-else ref="viewport" class="h-[32rem] overflow-auto" @scroll="onScroll">
      <div class="relative" :style="{ height: `${rows.length * rowHeight}px` }">
        <button
          v-for="(row, offset) in visibleRows"
          :key="row.id"
          class="absolute left-0 right-0 flex items-center gap-1 pr-3 text-left hover:bg-raised"
          :class="selectedId === row.id ? 'bg-raised text-ink' : 'text-muted'"
          :style="{ top: `${(startIndex + offset) * rowHeight}px`, height: `${rowHeight}px`, paddingLeft: `${12 + row.depth * 14}px` }"
          type="button"
          @click="emit('select', row.id)"
        >
          <span
            class="flex h-5 w-5 shrink-0 items-center justify-center text-dim"
            @click.stop="row.hasChildren && toggle(row.id)"
          >
            <span v-if="row.hasChildren" class="material-symbols-outlined text-[16px]">
              {{ row.open ? "expand_more" : "chevron_right" }}
            </span>
          </span>
          <span class="material-symbols-outlined text-[16px]" :style="{ color: iconFor(nodeOf(row.id)?.className ?? '').color }">{{ iconFor(nodeOf(row.id)?.className ?? '').name }}</span>
          <span class="truncate font-mono text-sm">{{ nodeOf(row.id)?.name }}</span>
          <span class="ml-auto hidden shrink-0 font-mono text-[11px] text-dim sm:inline">{{ nodeOf(row.id)?.className }}</span>
        </button>
      </div>
      <p v-if="rows.length === 0" class="px-3 py-6 text-center text-sm text-dim">This file has no instances.</p>
    </div>
  </section>
</template>
