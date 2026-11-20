<script setup lang="ts">
import type { RbxNode, RbxPropertyValue } from "@towerlab/dom-schema";
import { formatPropertyValue, propertyTypeName, readSource, sourcePreview } from "../utils/format";

const props = defineProps<{
  node: RbxNode | null;
}>();

const sourceOpen = ref(false);
const sourceText = ref("");
const copied = ref(false);

const entries = computed(() => {
  if (!props.node) return [];
  return Object.entries(props.node.properties).sort(([a], [b]) => a.localeCompare(b));
});

watch(
  () => props.node?.id,
  () => {
    sourceOpen.value = false;
  },
);

function shownValue(name: string, value: RbxPropertyValue): string {
  if (name !== "Source") return formatPropertyValue(value);
  return sourcePreview(readSource(value));
}

function openSource(value: RbxPropertyValue) {
  sourceText.value = readSource(value);
  copied.value = false;
  sourceOpen.value = true;
}

function closeSource() {
  sourceOpen.value = false;
}

async function copySource() {
  await navigator.clipboard.writeText(sourceText.value);
  copied.value = true;
  window.setTimeout(() => {
    copied.value = false;
  }, 1600);
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === "Escape") closeSource();
}

watch(sourceOpen, (open) => {
  if (open) window.addEventListener("keydown", onKeydown);
  else window.removeEventListener("keydown", onKeydown);
});

onBeforeUnmount(() => window.removeEventListener("keydown", onKeydown));
</script>

<template>
  <section class="flex min-h-[16rem] flex-col rounded-xl bg-subtle lg:min-h-0">
    <div class="border-b border-border-subtle px-4 py-3">
      <h2 class="font-display text-sm font-semibold tracking-tight text-ink">Properties</h2>
      <p v-if="node" class="mt-1 truncate font-mono text-xs text-dim">{{ node.className }} · {{ node.name }}</p>
      <p v-else class="mt-1 text-xs text-dim">Select an instance.</p>
    </div>
    <div v-if="node" class="max-h-[32rem] overflow-auto p-2 lg:max-h-none lg:flex-1">
      <p v-if="entries.length === 0" class="px-2 py-4 text-sm text-dim">No stored properties.</p>
      <div v-for="[name, value] in entries" :key="name" class="grid grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] gap-3 border-b border-border-subtle/70 px-2 py-2 last:border-b-0">
        <div class="min-w-0">
          <p class="truncate font-mono text-xs text-ink">{{ name }}</p>
          <p class="font-mono text-[10px] uppercase tracking-wider text-dim">{{ propertyTypeName(value) }}</p>
        </div>
        <div class="min-w-0">
          <p class="break-all font-mono text-xs text-muted">{{ shownValue(name, value) }}</p>
          <button
            v-if="name === 'Source'"
            class="mt-2 rounded-lg bg-raised px-2.5 py-1 font-mono text-[11px] text-ink hover:bg-container-high"
            type="button"
            @click="openSource(value)"
          >
            Open source
          </button>
        </div>
      </div>
    </div>
    <div
      v-if="sourceOpen"
      class="fixed inset-0 z-[70] flex items-end justify-center p-4 sm:items-center"
      role="presentation"
      @keydown="onKeydown"
    >
      <button class="absolute inset-0 bg-black/60" type="button" aria-label="Close source" @click="closeSource" />
      <div
        class="relative flex max-h-[85vh] w-full max-w-4xl flex-col rounded-xl border border-border-subtle bg-overlay p-5 shadow-xl"
        role="dialog"
        aria-labelledby="source-title"
      >
        <div class="mb-4 flex items-start justify-between gap-4">
          <div class="min-w-0">
            <h2 id="source-title" class="font-display text-lg font-semibold tracking-tight text-ink">Source</h2>
            <p v-if="node" class="mt-1 truncate font-mono text-xs text-dim">{{ node.className }} · {{ node.name }}</p>
          </div>
          <button
            class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-dim hover:bg-raised hover:text-ink"
            type="button"
            aria-label="Close"
            @click="closeSource"
          >
            <span class="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>
        <pre class="max-h-[60vh] min-h-40 overflow-auto whitespace-pre rounded-lg bg-subtle p-3 font-mono text-xs leading-relaxed text-muted">{{ sourceText }}</pre>
        <button
          class="mt-4 rounded-xl bg-mint py-3 font-mono text-sm font-medium text-canvas shadow-mint transition active:scale-[0.99]"
          type="button"
          @click="copySource"
        >
          {{ copied ? "Copied" : "Copy source" }}
        </button>
      </div>
    </div>
  </section>
</template>
