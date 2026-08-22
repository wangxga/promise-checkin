/** POST /upload/avatar 响应体 */
export interface UploadResult {
  /** 上传后的文件可访问 URL（形如 /uploads/{userId}/{随机}.png） */
  url: string
}
