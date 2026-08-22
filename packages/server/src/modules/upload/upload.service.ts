import { promises as fs } from 'node:fs'
import path from 'node:path'
import { randomBytes } from 'node:crypto'
import { config } from '../../config/index.js'
import { logger } from '../../lib/logger.js'

/**
 * Upload Service — 文件上传业务逻辑
 * 职责：把 multer 拿到的内存文件落到磁盘，返回可访问 URL
 * 不接触 HTTP（无 ctx）
 */

/** MIME → 扩展名映射（与 config.upload.allowedTypes 对应） */
const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

/**
 * 保存用户头像
 * - 每个用户一个独立子目录 {userId}/，保证一个用户目录只有一个头像文件
 * - 换头像时先删除该目录下旧文件，再写新文件（让旧 URL 立即失效，URL 不可猜）
 * - 文件名用 12 位随机 hex，避免被遍历
 *
 * @param userId 用户 ID（作为子目录）
 * @param file   multer 内存模式的文件对象
 * @returns 可访问的 URL（形如 /uploads/{userId}/{随机}.png）
 */
export async function saveAvatar(
  userId: number,
  file: { buffer: Buffer; mimetype: string },
): Promise<string> {
  const ext = MIME_TO_EXT[file.mimetype]
  if (!ext) {
    // 正常不会走到这里，controller 的 fileFilter 已经拦截过非图片
    throw new Error(`[upload] 不支持的 MIME 类型: ${file.mimetype}`)
  }

  const userDir = path.resolve(config.upload.dir, String(userId))
  await fs.mkdir(userDir, { recursive: true })

  // 清理该用户目录下的旧头像文件（保证目录内始终只有一个文件）
  try {
    const oldFiles = await fs.readdir(userDir)
    await Promise.all(oldFiles.map((f) => fs.unlink(path.join(userDir, f)).catch(() => {})))
  } catch (e) {
    logger.warn({ err: e }, '[upload] 清理旧头像失败，忽略继续')
  }

  // 写新文件
  const filename = `${randomBytes(6).toString('hex')}.${ext}`
  const filePath = path.join(userDir, filename)
  await fs.writeFile(filePath, file.buffer)

  return `${config.upload.urlPrefix}/${userId}/${filename}`
}
