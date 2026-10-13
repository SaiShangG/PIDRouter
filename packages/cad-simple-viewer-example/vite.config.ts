import { existsSync } from 'fs'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'
import vue from '@vitejs/plugin-vue'
import { defineConfig, loadEnv } from 'vite'
import { viteStaticCopy } from 'vite-plugin-static-copy'
import { exampleRollupOutput } from '../vite-config/pluginRollupOutput'
import {
  NETWORK_DEFAULTS,
  readHttpUrl,
  readPort,
  readPositiveInteger,
  readProxySetting
} from './src/networkConfig'

const __dirname = dirname(fileURLToPath(import.meta.url))

/** Relative to this package root; works with vite-plugin-static-copy on Windows. */
const VIEWER_RUNTIME_SRC = '../cad-html-plugin/dist/viewer-runtime.iife.js'

function assertViewerRuntimeExists(): void {
  const runtimePath = resolve(__dirname, VIEWER_RUNTIME_SRC)
  if (!existsSync(runtimePath)) {
    throw new Error(
      'viewer-runtime.iife.js was not found. Build @mlightcad/cad-html-plugin first ' +
        '(pnpm --filter @mlightcad/cad-html-plugin build, or nx run-many -t build).'
    )
  }
}

export default defineConfig(({ mode }) => {
  assertViewerRuntimeExists()
  const env = loadEnv(mode, __dirname, '')
  const processAssistantTarget = readHttpUrl(
    env.VITE_PROCESS_ASSISTANT_API_URL,
    'VITE_PROCESS_ASSISTANT_API_URL'
  )
  readProxySetting(env.VITE_PROCESS_ASSISTANT_USE_PROXY)
  readPositiveInteger(
    env.VITE_PROCESS_ASSISTANT_PROJECT_ID,
    'VITE_PROCESS_ASSISTANT_PROJECT_ID',
    NETWORK_DEFAULTS.projectId
  )
  const frontendHost =
    env.PID_FRONTEND_HOST?.trim() || NETWORK_DEFAULTS.frontendHost

  return {
    base: './',
    server: {
      host: frontendHost,
      port: readPort(
        env.PID_FRONTEND_PORT,
        'PID_FRONTEND_PORT',
        NETWORK_DEFAULTS.frontendPort
      ),
      strictPort: true,
      proxy: {
        '/api': {
          target: processAssistantTarget,
          changeOrigin: true
        },
        '/Uploads': {
          target: processAssistantTarget,
          changeOrigin: true
        }
      }
    },
    preview: {
      host: frontendHost,
      port: readPort(
        env.PID_PREVIEW_PORT,
        'PID_PREVIEW_PORT',
        NETWORK_DEFAULTS.previewPort
      ),
      strictPort: true
    },
    build: {
      modulePreload: false,
      minify: true,
      rollupOptions: {
        input: {
          main: resolve(__dirname, 'index.html')
        },
        output: exampleRollupOutput
      }
    },
    plugins: [
      vue(),
      viteStaticCopy({
        targets: [
          {
            src: './node_modules/@mlightcad/cad-simple-viewer/dist/*-worker.js',
            dest: 'workers'
          },
          {
            src: VIEWER_RUNTIME_SRC,
            dest: ''
          }
        ]
      })
    ]
  }
})
