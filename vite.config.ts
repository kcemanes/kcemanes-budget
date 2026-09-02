import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  plugins: [react()],
  // Project page lives at https://kcemanes.github.io/kcemanes-budget/;
  // dev server stays at the root.
  base: command === 'build' ? '/kcemanes-budget/' : '/',
}))
