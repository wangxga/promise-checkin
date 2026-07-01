/**
 * 请求响应类型（与后端 ApiResponse 对齐，从 shared 复用）
 */
import type { ApiResponse } from '@promise-checkin/shared'

/** 请求方法 */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

/** 请求配置 */
export interface RequestOptions {
  url: string
  method?: HttpMethod
  data?: Record<string, unknown> | string
  /** 是否显示 loading（默认 false） */
  showLoading?: boolean
  /** 是否需要鉴权（默认 true，登录接口设 false） */
  auth?: boolean
  /** 自定义 header */
  header?: Record<string, string>
}

export type { ApiResponse }
