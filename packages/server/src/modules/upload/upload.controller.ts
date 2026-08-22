import Router from '@koa/router'
import multer from '@koa/multer'
import type { Context } from 'koa'
import { config } from '../../config/index.js'
import { ok } from '../../shared-utils/response.js'
import { BusinessError } from '../../shared-utils/errors.js'
import * as uploadService from './upload.service.js'
import type { UploadResult } from '@promise-checkin/shared'

/**
 * Upload Controller — HTTP 层
 * 路由挂载在 /api/v1/upload 下
 */
export const uploadRouter = new Router({ prefix: '/upload' })

// multer：内存模式（拿 buffer，service 直接落盘），大小限制走配置，类型白名单
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.upload.maxFileSize },
  fileFilter: (_req, file, cb) => {
    if (!config.upload.allowedTypes.includes(file.mimetype)) {
      // 拒绝：传 error + false。multer 把 error 包装成路由层异常，被全局 error 中间件捕获
      cb(new Error(`不支持的文件类型: ${file.mimetype}，仅支持 ${config.upload.allowedTypes.join(', ')}`), false)
      return
    }
    cb(null, true)
  },
})

/**
 * POST /upload/avatar — 上传用户头像
 * form-data 字段名: file
 *
 * 流程：multer 解析 → 校验类型/大小 → service 落盘 → 返回 URL
 * 前端拿到 url 后，再调 PUT /auth/profile 把 url 写回用户表
 */
uploadRouter.post('/avatar', upload.single('file'), async (ctx: Context) => {
  const file = ctx.file
  if (!file) {
    throw BusinessError.validation({ file: '文件不能为空' }, '请选择要上传的文件')
  }
  const userId = ctx.state.userId as number
  const url = await uploadService.saveAvatar(userId, {
    buffer: file.buffer,
    mimetype: file.mimetype,
  })
  const result: UploadResult = { url }
  ok(ctx, result)
})
