import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  worker: {
    format: 'es',
  },
  build: {
    chunkSizeWarningLimit: 3400,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom'],
          radix: [
            '@radix-ui/react-tooltip',
            '@radix-ui/react-dropdown-menu',
            '@radix-ui/react-scroll-area',
            '@radix-ui/react-dialog',
            '@radix-ui/react-checkbox',
            '@radix-ui/react-popover',
            '@radix-ui/react-slider',
            '@radix-ui/react-separator',
          ],
          monaco: ['monaco-editor'],
          lsp: [
            'vscode-jsonrpc',
            'vscode-languageserver',
            'vscode-languageserver-protocol',
            'vscode-languageserver-textdocument',
            'vscode-languageserver-types',
          ],
          icons: ['lucide-react'],
        },
      },
    },
  },
})
