/// <reference types='@dcloudio/types' />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<Record<string, unknown>, Record<string, unknown>, unknown>
  export default component
}

interface ImportMetaEnv {
  readonly VITE_SERVER_BASEURL: string
  readonly VITE_AUTH_MODE: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
