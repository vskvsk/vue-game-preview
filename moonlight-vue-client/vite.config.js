import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@moonlight': resolve(__dirname, '../moonlight-web-stream-file')
    }
  },
  server: {
    port: 3000,
    fs: {
      // 允许 Vite dev server 服务根目录以外的文件（Worker 文件在上层目录）
      allow: ['..']
    },
    proxy: {
      '/api/host/stream': {
        target: 'ws://localhost:8080',
        ws: true,
        changeOrigin: true
      },
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true
      },
      '/host/stream': {
        target: 'ws://localhost:8080',
        ws: true
      }
    }
  },
  worker: {
    format: 'es'
  }
})
