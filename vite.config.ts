import { defineConfig } from 'vite'

export default defineConfig({
  base: './',
  server: {
    port: 8024,
    host: true,
    allowedHosts: true
  }
})
