export default defineNuxtConfig({
  compatibilityDate: "2025-07-15",
  future: {
    compatibilityVersion: 4,
  },
  ssr: false,
  devtools: { enabled: false },
  modules: ["@nuxtjs/tailwindcss"],
  css: ["~/assets/css/main.css"],
  app: {
    head: {
      title: "TowerLab",
      htmlAttrs: { class: "dark", lang: "en" },
      meta: [
        { name: "description", content: "Inspect and convert Roblox tower files locally in your browser." },
        { name: "theme-color", content: "#09090B" },
        { name: "viewport", content: "width=device-width, initial-scale=1" },
      ],
      link: [
        { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
        { rel: "preconnect", href: "https://fonts.googleapis.com" },
        { rel: "preconnect", href: "https://fonts.gstatic.com", crossorigin: "" },
        {
          rel: "stylesheet",
          href: "https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap",
        },
        {
          rel: "stylesheet",
          href: "https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0&display=swap",
        },
      ],
    },
  },
  vite: {
    worker: { format: "es" },
    optimizeDeps: {
      exclude: ["@towerlab/wasm-bridge"],
    },
    server: {
      fs: {
        allow: ["../.."],
      },
    },
  },
});
