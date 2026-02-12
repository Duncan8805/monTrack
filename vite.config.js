import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/monTrack/',
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.js',
    server: {
      deps: {
        inline: ['@asamuzakjp/css-color']
      },
    },
    alias: [{ find: /\.css$/, replacement: '/src/test/styleMock.js' }],
  },
})
