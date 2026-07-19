import type { CheckinStatus, CheckinSource, AdjustmentType } from '../enums/checkin.js'

/**
 * 打卡记录实体（数据库形态）
 * 含 source/adjustmentType/original_scheduled_* 等 demo 新增字段
 */
export interface Checkin {
  id: number
  planId: number
  /** 操作用户 ID（冗余，便于权限校验） */
  userId: number
  /** 被打卡成员 ID（P2 预留，MVP 为 null） */
  memberId: number | null

  /** 计划应打卡日期 YYYY-MM-DD（始终用户本地时区日期，不参与 UTC 换算） */
  scheduledDate: string
  /** 计划应打卡时间 HH:mm（固定排期时有值） */
  scheduledTime: string | null

  status: CheckinStatus
  /** 实际打卡时间（status=done 时填） */
  actualTime: string | null
  /** 记录数值（如血压 120.00），仅 plan.recordValue=true 时使用 */
  value: number | null
  /** 备注（请假原因/打卡说明） */
  remark: string | null

  /** 来源：scheduled 按排期 / retroactive 事后补录 */
  source: CheckinSource
  /** 调整类型：reschedule 调整排期 / makeup 补打 / null 未调整 */
  adjustmentType: AdjustmentType | null
  /** 调整排期前的原定日期（仅 reschedule 时有值，用于追溯） */
  originalScheduledDate: string | null
  /** 调整排期前的原定时间 */
  originalScheduledTime: string | null

  createdAt: string
  updatedAt: string
  deletedAt: string | null
}
