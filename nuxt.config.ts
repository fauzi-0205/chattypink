// nuxt.config.ts
export default defineNuxtConfig({
  // Jika Anda pakai Nuxt 4, pastikan baris ini ada:
  future: {
    compatibilityVersion: 4,
  },
  
  // Daftarkan modul tailwind di sini
  modules: ['@nuxtjs/tailwindcss'],
  
  devtools: { enabled: true }
})