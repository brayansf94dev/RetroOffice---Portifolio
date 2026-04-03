import { defineConfig } from 'vite'

export default defineConfig({
  // IMPORTANTE: se o repositório NÃO for usuario.github.io
  // troque '/' pelo nome do seu repo, ex: '/portfolio-n64/'
  base: '/',
  build: {
    outDir: 'dist',
  },
})
