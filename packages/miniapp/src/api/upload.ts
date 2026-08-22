/**
 * Upload API — 文件上传
 *
 * 注意：文件上传走 uni.uploadFile（不走 http.ts 的 uni.request 封装），
 * 因为 http.ts 默认 Content-Type 是 JSON，传不了 multipart/form-data。
 *
 * token 由 interceptor.ts 预注册的 uploadFile 拦截器自动注入，
 * 不用在这里手动塞 Authorization header。
 */
import type { UploadResult } from '@promise-checkin/shared'

const BASE_URL = import.meta.env.VITE_SERVER_BASEURL || ''

/**
 * 把服务端返回的相对资源路径（/uploads/...）拼成完整 URL。
 * DB 里只存相对路径（换域名不用洗数据），展示时在此拼站点根。
 * BASE_URL 形如 https://checkin.itwxg.com/api/v1，去掉 /api/vN 后缀即站点根
 */
export function resolveAssetUrl(path: string): string {
  if (/^https?:\/\//.test(path)) return path
  return `${BASE_URL.replace(/\/api\/v\d+\/?$/, '')}${path}`
}

/** ApiError 形状（与 http.ts 一致，便于上层 catch 后取 message） */
interface ApiErrorBody {
  code: number
  message: string
  data?: unknown
}

/**
 * 上传头像
 * @param tempFilePath 微信 chooseAvatar / chooseMedia 返回的临时文件路径
 * @returns 服务器可访问 URL
 */
export function uploadAvatar(tempFilePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    uni.uploadFile({
      url: `${BASE_URL}/upload/avatar`,
      filePath: tempFilePath,
      name: 'file',
      success: (res) => {
        // 后端统一响应：{ code, message, data: { url } }
        // 注意：res.data 类型不确定——微信在某些基础库/平台下会把
        // Content-Type: application/json 的响应自动 parse 成对象，
        // 此时 JSON.parse(对象) 会抛异常。统一兼容两种形态。
        try {
          const body: ApiErrorBody & { data?: UploadResult } =
            typeof res.data === 'string' ? JSON.parse(res.data) : res.data
          if (body && body.code === 0 && body.data?.url) {
            resolve(body.data.url)
            return
          }
          reject(new Error(body?.message || `上传失败(${res.statusCode})`))
        } catch {
          reject(new Error(`上传响应解析失败(${res.statusCode})`))
        }
      },
      fail: (err) => {
        reject(new Error(err.errMsg || '上传失败'))
      },
    })
  })
}
