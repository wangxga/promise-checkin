/// <reference types='@dcloudio/types' />
/// <reference types='vite/client' />

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

/** uni 原生 switch 的 change 事件：载荷在 detail.value（布尔）。
 *  @dcloudio/types 把 switch 的 $event 推导成裸 Event（无 detail），模板里需断言 */
interface UniSwitchEvent extends Event {
  detail: { value: boolean }
}

/** uni 原生 input 的 input 事件：载荷在 detail.value（字符串） */
interface UniInputEvent extends Event {
  detail: { value: string }
}
