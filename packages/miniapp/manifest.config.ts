import { readFileSync } from 'node:fs'
import path from 'node:path'

// 从 env/ 读取环境变量
function loadEnvFile(file: string): Record<string, string> {
  try {
    const content = readFileSync(file, 'utf-8')
    const env: Record<string, string> = {}
    for (const line of content.split('\n')) {
      const m = line.match(/^\s*VITE_([A-Z_]+)\s*=\s*(.*)\s*$/)
      if (m) env[m[1]] = m[2].trim()
    }
    return env
  } catch {
    return {}
  }
}

const env = { ...loadEnvFile(path.resolve('env/.env')), ...loadEnvFile(path.resolve('env/.env.development')) }

// 0.4.x：直接导出普通对象，插件会读取并覆盖 src/manifest.json
export default {
  name: env.APP_TITLE || '如约打卡',
  appid: env.UNI_APPID || '',
  description: '通用按计划打卡 + 缺席追溯工具',
  versionName: '0.1.0',
  versionCode: '100',
  'mp-weixin': {
    appid: env.WX_APPID || '',
    setting: {
      urlCheck: false, // 开发期关闭域名校验（生产设 true）
      es6: true,
      postcss: true,
      minified: true,
    },
    usingComponents: true,
    lazyCodeLoading: 'requiredComponents',
    // 最低基础库版本（canvas 2d 需要 2.9.0+）
    libVersion: '3.0.0',
  },
  vueVersion: '3',
}
