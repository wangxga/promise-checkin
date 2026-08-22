import type { ScheduleConfig, WeekdayRule, EverydayRule } from '@promise-checkin/shared'
import { shanghaiDateStr } from './timezone.js'

/**
 * 排期生成工具
 * 从 demo 移植并类型化，被 plan.service（建计划时首次生成）和 jobs/scheduleGenerator（每日续期）复用
 *
 * 核心概念：按 scheduleConfig.rules 判断某天是否应打卡，匹配则生成 {date, time} 槽位
 *
 * 时区口径：所有日期判断都按上海时区（UTC+8）显式计算，不依赖服务器 process.env.TZ。
 * 这样在 UTC 宿主机（Docker）和上海宿主机上行为一致。
 */

const SHANGHAI_OFFSET_MS = 8 * 60 * 60 * 1000

/** 任意 UTC Date → 上海时区的 ISO 周几（1=周一 ... 7=周日） */
export function isoWeekday(date: Date): number {
  const sh = new Date(date.getTime() + SHANGHAI_OFFSET_MS)
  // 周日=0 → 7，其余不变
  return sh.getUTCDay() === 0 ? 7 : sh.getUTCDay()
}

/** 判断某天是否匹配某条排期规则 */
export function matchRule(date: Date, rule: WeekdayRule | EverydayRule): boolean {
  if ('weekday' in rule) {
    return isoWeekday(date) === rule.weekday
  }
  if ('every' in rule && rule.every === 'day') {
    return true
  }
  return false
}

export interface GeneratedSlot {
  /** 该日期对应的 UTC 午夜 Date（= new Date("YYYY-MM-DD")），
   *  与 schema scheduledDate @db.Date 的读写口径一致 */
  scheduledDate: Date
  scheduledTime: string | null
}

/**
 * 按上海时区，把日期字符串 YYYY-MM-DD 转成 UTC 午夜的 Date 对象
 * 与 Prisma 读取 @db.Date 字段时返回的 Date 对象口径一致（也是 UTC 午夜）
 */
function dateStrToUtcMidnight(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00.000Z`)
}

/**
 * 按 scheduleConfig 在 [fromDate, toDate] 区间生成所有应打卡槽位
 * - fixed 模式：匹配 rules 的日期，每个 rule 生成一个槽位
 * - flexible 模式（scheduleConfig=null）：返回空（用户随时手动打卡）
 *
 * 实现口径：以"天"为单位（上海时区的 YYYY-MM-DD）遍历，
 * 每天用其 UTC 午夜 Date 对象做 weekday 匹配和存储，
 * 避免 setHours / getDay 受服务器时区污染。
 */
export function generateSlots(
  scheduleConfig: ScheduleConfig | null,
  fromDate: Date,
  toDate: Date,
): GeneratedSlot[] {
  if (!scheduleConfig?.rules?.length) return []

  const slots: GeneratedSlot[] = []
  // 按上海时区的 YYYY-MM-DD 逐天遍历
  const startStr = shanghaiDateStr(fromDate)
  const endStr = shanghaiDateStr(toDate)
  const start = dateStrToUtcMidnight(startStr)
  const end = dateStrToUtcMidnight(endStr)

  const cursor = new Date(start)
  while (cursor <= end) {
    for (const rule of scheduleConfig.rules) {
      if (matchRule(cursor, rule)) {
        slots.push({
          scheduledDate: new Date(cursor),
          scheduledTime: rule.time ?? null,
        })
      }
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }
  return slots
}
