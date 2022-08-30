import { defineConfig } from 'vitest/config'

defineConfig({
  test: {
    environment: 'jsdom',
  }
})