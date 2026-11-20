<script setup lang="ts">
const open = defineModel<boolean>({ required: true });
const props = defineProps<{ summary: string }>();

const copied = ref(false);

const text = computed(() => {
  const lines = [
    "TowerLab diagnostic summary",
    `Page: ${window.location.pathname}`,
    `Time: ${new Date().toISOString()}`,
    `Browser: ${navigator.userAgent}`,
    props.summary.trim() || "No file loaded.",
    "",
    "File contents are not included.",
  ];
  return lines.join("\n");
});

async function copy() {
  await navigator.clipboard.writeText(text.value);
  copied.value = true;
  window.setTimeout(() => {
    copied.value = false;
  }, 1600);
}

function close() {
  open.value = false;
}
</script>

<template>
  <div v-if="open" class="fixed inset-0 z-[70] flex items-end justify-center p-4 sm:items-center" role="presentation">
    <button class="absolute inset-0 bg-black/60" type="button" aria-label="Close feedback dialog" @click="close" />
    <div
      class="relative w-full max-w-lg rounded-xl border border-border-subtle bg-overlay p-5 shadow-xl"
      role="dialog"
      aria-labelledby="feedback-title"
    >
      <div class="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 id="feedback-title" class="font-display text-lg font-semibold tracking-tight text-ink">Feedback</h2>
          <p class="mt-1 text-sm text-muted">Copy this summary into a bug report. The file itself stays on your machine.</p>
        </div>
        <button
          class="flex h-8 w-8 items-center justify-center rounded-lg text-dim hover:bg-raised hover:text-ink"
          type="button"
          aria-label="Close"
          @click="close"
        >
          <span class="material-symbols-outlined text-[18px]">close</span>
        </button>
      </div>
      <pre class="max-h-64 overflow-auto whitespace-pre-wrap rounded-lg bg-subtle p-3 font-mono text-xs leading-relaxed text-muted">{{ text }}</pre>
      <button
        class="mt-4 w-full rounded-xl bg-mint py-3 font-mono text-sm font-medium text-canvas shadow-mint transition active:scale-[0.99]"
        type="button"
        @click="copy"
      >
        {{ copied ? "Copied" : "Copy summary" }}
      </button>
    </div>
  </div>
</template>
