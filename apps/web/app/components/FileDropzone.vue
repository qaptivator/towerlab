<script setup lang="ts">
const props = defineProps<{
  title: string;
  busy?: boolean;
}>();

const emit = defineEmits<{
  file: [file: File];
}>();

const input = ref<HTMLInputElement | null>(null);
const dragging = ref(false);

function openPicker() {
  if (!props.busy) input.value?.click();
}

function take(file: File | undefined) {
  if (file) emit("file", file);
}

function onChange(event: Event) {
  const target = event.target as HTMLInputElement;
  take(target.files?.[0]);
  target.value = "";
}

function onDrop(event: DragEvent) {
  dragging.value = false;
  take(event.dataTransfer?.files?.[0]);
}
</script>

<template>
  <div
    class="group relative flex w-full cursor-pointer flex-col items-center justify-center rounded-xl bg-subtle px-6 py-10 text-center transition-colors md:py-14"
    :class="dragging ? 'bg-raised' : 'hover:bg-raised'"
    role="button"
    tabindex="0"
    @click="openPicker"
    @keydown.enter.prevent="openPicker"
    @keydown.space.prevent="openPicker"
    @dragenter.prevent="dragging = true"
    @dragover.prevent="dragging = true"
    @dragleave.prevent="dragging = false"
    @drop.prevent="onDrop"
  >
    <input
      ref="input"
      class="sr-only"
      type="file"
      accept=".rbxl,.rbxlx,.rbxm,.rbxmx,application/octet-stream"
      @change="onChange"
    />
    <svg class="pointer-events-none absolute inset-0 h-full w-full" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect
        fill="none"
        height="100%"
        width="100%"
        rx="12"
        stroke-width="1.5"
        stroke-dasharray="6 6"
        :stroke="dragging ? '#3F3F46' : '#27272A'"
      />
    </svg>
    <div class="relative z-10 flex flex-col items-center">
      <div class="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-container text-muted transition-colors group-hover:text-mint">
        <span class="material-symbols-outlined text-[26px]">{{ busy ? "progress_activity" : "upload_file" }}</span>
      </div>
      <p class="mb-1 text-base font-medium text-ink">{{ busy ? "Reading file…" : title }}</p>
      <p class="mb-5 text-sm text-dim">.rbxl, .rbxlx, .rbxm, and .rbxmx</p>
      <span class="rounded-lg bg-container px-3 py-1.5 text-sm text-ink shadow-sm transition-colors group-hover:bg-container-high">
        or browse files
      </span>
    </div>
  </div>
</template>
