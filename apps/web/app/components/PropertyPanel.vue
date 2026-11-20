<script setup lang="ts">
import type { RbxNode } from "@towerlab/dom-schema";
import { formatPropertyValue, propertyTypeName } from "../utils/format";

const props = defineProps<{
  node: RbxNode | null;
}>();

const entries = computed(() => {
  if (!props.node) return [];
  return Object.entries(props.node.properties).sort(([a], [b]) => a.localeCompare(b));
});
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
        <p class="break-all font-mono text-xs text-muted">{{ formatPropertyValue(value) }}</p>
      </div>
    </div>
  </section>
</template>
