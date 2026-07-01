import type { PlanType, TimeMode, PlanStatus, OverdueHandling } from '../enums/plan'

/** 固定排期规则（按周几） */
export interface WeekdayRule {
  /** ISO 周几：1=周一 ... 7=周日 */
  weekday: number
  /** 时间 HH:mm */
  time: string
}

/** 固定排期规则（每天定时） */
export interface EverydayRule {
  every: 'day'
  time: string
}

/** 排期配置 */
export interface ScheduleConfig {
  rules: (WeekdayRule | EverydayRule)[]
}

/**
 * 计划实体（数据库形态）
 * 以 demo 实现的最新模型为准，03 文档的 used_count 已废弃，改为多口径计数
 */
export interface Plan {
  id: number
  userId: number
  /** MVP 始终为 null，P2 家庭功能启用 */
  familyId: number | null

  name: string
  type: PlanType
  /** 主题色 hex */
  color: string

  /** 总次数；null = 无限次（如量血压） */
  totalCount: number | null
  /** 起始进度（虚拟计数）：装 App 前已完成次数，只影响进度展示，不补造历史记录 */
  initialDoneCount: number
  /** App 内实际完成次数（冗余字段，syncPlanCounts 重算） */
  doneCount: number
  /** 缺席次数（冗余字段） */
  missedCount: number
  /** 缺席是否计入配额消耗 */
  absenceConsumes: boolean

  timeMode: TimeMode
  scheduleConfig: ScheduleConfig | null

  /** 逾期处理策略 */
  overdueHandling: OverdueHandling
  /** 宽限期（小时），仅 overdueHandling=AUTO_MISSED 时生效 */
  overdueGraceHours: number

  /** 是否记录数值（量血压=1） */
  recordValue: boolean
  /** 数值单位（mmHg/ml/个...） */
  valueUnit: string | null

  startDate: string | null
  endDate: string | null
  status: PlanStatus
  remark: string | null

  createdAt: string
  updatedAt: string
  /** 软删除时间；null = 未删除 */
  deletedAt: string | null
}

/** 计划进度派生数据（由后端 stats 或前端 composable 计算） */
export interface PlanProgress {
  /** 总已完成 = initialDoneCount + doneCount */
  totalDone: number
  /** 已消耗配额 = totalDone + (absenceConsumes ? missedCount : 0)；无限计划为 null */
  consumed: number | null
  /** 剩余配额 = totalCount - consumed；无限计划为 null */
  remain: number | null
  /** 进度 0~1 = consumed / totalCount；无限计划为 null */
  progress: number | null
}
