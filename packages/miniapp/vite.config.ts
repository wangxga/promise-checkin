import { defineConfig } from 'vite'
import uni from '@dcloudio/vite-plugin-uni'
import UniPages from '@uni-helper/vite-plugin-uni-pages'
import UniManifest from '@uni-helper/vite-plugin-uni-manifest'
import path from 'node:path'

/**
 * Vite 配置
 * - @dcloudio/vite-plugin-uni：uni-app 核心
 * - UniPages：基于文件的页面路由，自动生成 pages.json
 *   （每个页面 .vue 里用 <route> 块声明页面级配置）
 * - UniManifest：从 manifest.config.ts 生成 manifest.json
 */
export default defineConfig({
  plugins: [
    UniPages({
      // 扫描 src/pages 下的 .vue 文件自动生成路由
      dts: 'src/types/uni-pages.d.ts',
      // 强制 today 为首页（pages[0]），避免按字典序把 login 排到首页
      // 已登录用户冷启动应直接进 today，未登录由路由守卫拦截到 login
      homePage: 'pages/today/index',
    }),
    UniManifest(),
    uni(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
})
