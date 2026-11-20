<script setup lang="ts">
import type { LoadedRobloxFile } from "../composables/useRobloxFile";
import { formatBytes, formatCount } from "../utils/format";

defineProps<{
  file: LoadedRobloxFile;
}>();

defineEmits<{
  clear: [];
}>();
</script>

<template>
  <div class="flex w-full items-center justify-between gap-3 rounded-xl bg-subtle p-4">
    <div class="flex min-w-0 items-center gap-3.5">
      <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-container text-mint">
        <span class="material-symbols-outlined text-[20px]">inventory_2</span>
      </div>
      <div class="min-w-0">
        <p class="truncate font-mono text-sm text-ink">{{ file.name }}</p>
        <p class="mt-0.5 text-xs text-dim">
          {{ formatBytes(file.size) }}
          <span class="mx-1">·</span>
          {{ formatCount(file.stats.instances) }} instances
          <span class="mx-1">·</span>
          {{ formatCount(file.stats.parts) }} parts
          <span class="mx-1">·</span>
          {{ formatCount(file.stats.clientObjects) }} COs
          <span class="mx-1">·</span>
          {{ formatCount(file.stats.frames) }} frames
        </p>
        <p class="mt-0.5 text-xs text-dim">{{ file.kit.label }}</p>
      </div>
    </div>
    <button
      class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-dim hover:bg-container hover:text-ink"
      type="button"
      aria-label="Remove file"
      @click="$emit('clear')"
    >
      <span class="material-symbols-outlined text-[18px]">close</span>
    </button>
  </div>
</template>
