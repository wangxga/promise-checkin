import { defineConfig } from 'vite'
import uni from '@dcloudio/vite-plugin-uni'
import UniPages from '@uni-helper/vite-plugin-uni-pages'
import UniManifest from '@uni-helper/vite-plugin-uni-manifest'
import path from 'node:path'

/**
 * Vite 配置
 * - @dcloudio/vite-plugin-uni：uni-app 核心
 * - UniPages：基于文件的页面路由，自动生成 pages.json
 * - UniManifest：从 manifest.config.ts 生成 manifest.json
 */
export default defineConfig({
  // env 文件在 env/ 目录（不是项目根）
  envDir: path.resolve(__dirname, 'env'),
  plugins: [
    UniPages({
      // 扫描 src/pages 下的 .vue 文件自动生成路由
      dts: 'src/types/uni-pages.d.ts',
      // 强制 today 为首页（pages[0]），避免按字典序把 login 排到首页
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
  css: {
    preprocessorOptions: {
      scss: {
        // 静默 Sass 弃用警告（全部来自 wot-design-uni / Vite 旧编译管线，非项目自身样式）：
        // - import / global-builtin：组件库还在用 @import 和全局内建函数（Sass 3.0 移除），
        //   quietDeps 在 Vite 5.2 的旧管线（自定义 importer）下不生效，只能显式静默
        // - legacy-js-api：Vite 5.2 固定用旧 JS API 调 Sass（升 5.4 才能切 modern，uni-app 锁版本）
        silenceDeprecations: ['import', 'global-builtin', 'legacy-js-api'],
      },
    },
  },
})
