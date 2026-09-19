import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  // The public build (`npm run build:public`, mode "public") outputs to
  // its own directory so it never collides with the default admin
  // build's `dist/` — the default build's outDir is untouched.
  build: mode === 'public' ? { outDir: 'dist-public' } : undefined,
  // Public site is served at the custom domain's root (www.brotdeslebens.ch),
  // not a /brotdeslebens/ project-page subpath, so both builds use base '/'.
  base: '/',
}))
