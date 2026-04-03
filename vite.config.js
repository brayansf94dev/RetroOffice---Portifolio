import { defineConfig } from 'vite'

// Durante o build, substitui os imports CDN pelos pacotes npm locais.
// Em desenvolvimento com Live Server, os arquivos src/ usam CDN diretamente — sem Node.
export default defineConfig({
  // Se o repo não for a raiz do GitHub Pages, coloque o nome aqui:
  // base: '/nome-do-repo/',
  base: './',

  resolve: {
    alias: [
      {
        find: 'https://unpkg.com/three@0.150.1/build/three.module.js',
        replacement: 'three',
      },
      {
        find: 'https://unpkg.com/three@0.150.1/examples/jsm/controls/OrbitControls.js',
        replacement: 'three/examples/jsm/controls/OrbitControls.js',
      },
      {
        find: 'https://unpkg.com/three@0.150.1/examples/jsm/renderers/CSS3DRenderer.js',
        replacement: 'three/examples/jsm/renderers/CSS3DRenderer.js',
      },
    ],
  },

  build: {
    outDir: 'dist',
  },
})
