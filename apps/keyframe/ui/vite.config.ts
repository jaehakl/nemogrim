import { createLogger, defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const API_TARGET = 'http://127.0.0.1:8002'
const UPSTREAM_DOWN_CODES = new Set(['ECONNREFUSED', 'ECONNRESET'])

/** 프록시 오류 응답에 필요한 부분만 (@types/node 없이 쓰기 위한 구조 타입). */
interface WritableResponse {
  headersSent: boolean
  writableEnded: boolean
  writeHead: (status: number, headers: Record<string, string>) => WritableResponse
  end: (body: string) => void
}

function isUpstreamDown(error: unknown): boolean {
  return UPSTREAM_DOWN_CODES.has((error as { code?: string } | undefined)?.code ?? '')
}

// API가 아직 뜨지 않았거나 --reload로 재시작 중일 때의 연결 거부는 정상 상황이다.
// stack trace 대신 한 줄 안내만 남긴다.
const logger = createLogger()
const logError = logger.error.bind(logger)
logger.error = (message, options) => {
  if (message.includes('http proxy error') && isUpstreamDown(options?.error)) {
    logger.warnOnce(`[keyframe] API(${API_TARGET})가 아직 준비되지 않았습니다. 준비되면 UI가 자동으로 다시 연결합니다.`)
    return
  }
  logError(message, options)
}

export default defineConfig({
  plugins: [react()],
  customLogger: logger,
  server: {
    host: '127.0.0.1',
    port: 5175,
    strictPort: true,
    proxy: {
      '/api': {
        target: API_TARGET,
        changeOrigin: true,
        configure: (proxy) => {
          // Vite 기본 처리(빈 500)보다 먼저 응답해 UI가 "API 준비 중"을 구분하고 재시도하게 한다.
          proxy.on('error', (error, _request, response) => {
            if (!isUpstreamDown(error) || !('writeHead' in response)) return
            const res = response as unknown as WritableResponse
            if (res.headersSent || res.writableEnded) return
            res.writeHead(503, {
              'Content-Type': 'application/json; charset=utf-8',
              'X-Keyframe-Upstream': 'unavailable',
            })
            res.end(JSON.stringify({
              detail: 'API 서버에 연결할 수 없습니다. API가 시작되는 중이면 잠시 후 자동으로 다시 연결합니다.',
            }))
          })
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.ts',
  },
})
