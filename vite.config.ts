import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => ({
  base: './',
  ...(mode === 'win7' ? { build: { target: 'chrome108', cssTarget: 'chrome108' } } : {}),
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    watch: {
      ignored: [
        '**/src-tauri/target/**',
        '**/src-tauri/target/**/*',
        '**/target/**',
        '**/target/**/*',
      ],
    },
  },
  plugins: [react()],
}))
