/**
 * HTTP 请求核心封装
 * - 包装 uni.request，返回 Promise<ApiResponse.data>
 * - 业务错误（code !== 0）：抛出，由调用方 catch 或全局 toast
 * - 401（token 失效）：跳登录页
 *
 * 解耦原则：API 层只管"发请求 + 类型转换"，不处理业务逻辑
 */
import type { RequestOptions, ApiResponse } from './types'
import { ErrorCode } from '@promise-checkin/shared'
import { useTokenStore } from '@/store/token'

/** 业务错误 */
export class ApiError extends Error {
  code: number
  data: unknown
  constructor(code: number, message: string, data?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.data = data
  }
}

/** 跳登录页（带防抖，避免并发 401 多次跳转） */
let isRedirecting = false
function toLogin() {
  if (isRedirecting) return
  isRedirecting = true
  // 兜底超时复位：即使 reLaunch 的 complete/fail 都没触发，3 秒后强制复位
  setTimeout(() => (isRedirecting = false), 3000)
  const tokenStore = useTokenStore()
  tokenStore.clear()
  uni.reLaunch({
    url: '/pages/login/index',
    complete: () => (isRedirecting = false),
  })
}

export async function request<T = unknown>(options: RequestOptions): Promise<T> {
  const {
    url,
    method = 'GET',
    data,
    showLoading = false,
    header = { 'Content-Type': 'application/json' },
  } = options

  if (showLoading) uni.showLoading({ title: '加载中', mask: true })

  return new Promise<T>((resolve, reject) => {
    uni.request({
      url,
      method,
      data,
      header,
      success: (res) => {
        const body = res.data as ApiResponse<T>
        // HTTP 层面成功
        if (res.statusCode >= 200 && res.statusCode < 300) {
          if (body.code === ErrorCode.SUCCESS) {
            resolve(body.data)
            return
          }
          // token 失效
          if (body.code === ErrorCode.UNAUTHORIZED || body.code === ErrorCode.TOKEN_EXPIRED) {
            toLogin()
          }
          reject(new ApiError(body.code, body.message, body.data))
          return
        }
        // 401 直接跳登录
        if (res.statusCode === 401) {
          toLogin()
        }
        reject(new ApiError(body.code ?? ErrorCode.INTERNAL_ERROR, body.message ?? '请求失败'))
      },
      fail: (err) => {
        uni.showToast({ title: '网络异常，请稍后重试', icon: 'none' })
        reject(new ApiError(ErrorCode.INTERNAL_ERROR, err.errMsg || '网络异常'))
      },
      complete: () => {
        if (showLoading) uni.hideLoading()
      },
    })
  })
}

/** 便捷方法 */
export const http = {
  get: <T>(url: string, opts?: Partial<RequestOptions>) =>
    request<T>({ ...opts, url, method: 'GET' }),
  post: <T>(url: string, data?: Record<string, unknown>, opts?: Partial<RequestOptions>) =>
    request<T>({ ...opts, url, method: 'POST', data }),
  put: <T>(url: string, data?: Record<string, unknown>, opts?: Partial<RequestOptions>) =>
    request<T>({ ...opts, url, method: 'PUT', data }),
  del: <T>(url: string, opts?: Partial<RequestOptions>) =>
    request<T>({ ...opts, url, method: 'DELETE' }),
}
