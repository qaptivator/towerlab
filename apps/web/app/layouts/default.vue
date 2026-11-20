<script setup lang="ts">
const route = useRoute();
const feedbackOpen = ref(false);
const { summary } = useDiagnostics();

const inspectActive = computed(() => route.path.startsWith("/inspect") || route.path === "/");
const convertActive = computed(() => route.path.startsWith("/convert"));

function navClass(active: boolean) {
  return active
    ? "bg-raised text-ink"
    : "text-muted hover:text-ink";
}

function mobileClass(active: boolean) {
  return active ? "text-mint" : "text-dim hover:text-muted";
}
</script>

<template>
  <div class="flex min-h-screen flex-col bg-canvas text-ink">
    <header class="fixed inset-x-0 top-0 z-40 border-b border-transparent bg-canvas/80 backdrop-blur-xl">
      <div class="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 md:px-8">
        <div class="flex items-center gap-6">
          <NuxtLink to="/inspect" class="flex items-center gap-2" aria-label="TowerLab home">
            <span class="font-display text-lg font-semibold tracking-tight">towerlab</span>
            <AppMark />
          </NuxtLink>
          <nav class="hidden items-center gap-1 rounded-lg p-1 md:flex" aria-label="Primary">
            <NuxtLink to="/convert" class="rounded px-3 py-1.5 text-sm transition-colors" :class="navClass(convertActive)">Convert</NuxtLink>
            <NuxtLink to="/inspect" class="rounded px-3 py-1.5 text-sm transition-colors" :class="navClass(inspectActive)">Inspect</NuxtLink>
          </nav>
        </div>
        <button
          class="rounded-lg px-3 py-1.5 text-sm text-muted transition-colors hover:bg-raised hover:text-ink"
          type="button"
          @click="feedbackOpen = true"
        >
          Feedback
        </button>
      </div>
    </header>

    <main class="flex-1 pt-16 pb-20 md:pb-0">
      <slot />
    </main>

    <footer class="hidden border-t border-border-subtle md:block">
      <div class="mx-auto flex max-w-7xl items-center justify-between px-8 py-6 font-mono text-xs text-dim">
        <p>towerlab <span class="text-border-prominent">/</span> local tower tools</p>
        <p>Files stay in this browser</p>
      </div>
    </footer>

    <nav class="fixed inset-x-0 bottom-0 z-40 border-t border-border-subtle bg-canvas/90 backdrop-blur-xl md:hidden" aria-label="Primary">
      <div class="flex h-16 items-center justify-around pb-[env(safe-area-inset-bottom)]">
        <NuxtLink to="/convert" class="flex w-24 flex-col items-center gap-1 text-xs" :class="mobileClass(convertActive)">
          <span class="material-symbols-outlined text-[22px]">swap_horiz</span>
          Convert
        </NuxtLink>
        <NuxtLink to="/inspect" class="flex w-24 flex-col items-center gap-1 text-xs" :class="mobileClass(inspectActive)">
          <span class="material-symbols-outlined text-[22px]">manage_search</span>
          Inspect
        </NuxtLink>
      </div>
    </nav>

    <FeedbackDialog v-model="feedbackOpen" :summary="summary" />
  </div>
</template>
