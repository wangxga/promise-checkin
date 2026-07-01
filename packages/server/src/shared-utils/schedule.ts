import type { ScheduleConfig, WeekdayRule, EverydayRule } from '@promise-checkin/shared'

/**
 * 排期生成工具
 * 从 demo 移植并类型化，被 plan.service（建计划时首次生成）和 jobs/scheduleGenerator（每日续期）复用
 *
 * 核心概念：按 scheduleConfig.rules 判断某天是否应打卡，匹配则生成 {date, time} 槽位
 */

/** ISO 周几：1=周一 ... 7=周日（JS Date.getDay() 周日=0） */
export function isoWeekday(date: Date): number {
  return date.getDay() === 0 ? 7 : date.getDay()
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
  scheduledDate: Date
  scheduledTime: string | null
}

/**
 * 按 scheduleConfig 在 [fromDate, toDate] 区间生成所有应打卡槽位
 * - fixed 模式：匹配 rules 的日期，每个 rule 生成一个槽位
 * - flexible 模式（scheduleConfig=null）：返回空（用户随时手动打卡）
 */
export function generateSlots(
  scheduleConfig: ScheduleConfig | null,
  fromDate: Date,
  toDate: Date,
): GeneratedSlot[] {
  if (!scheduleConfig?.rules?.length) return []

  const slots: GeneratedSlot[] = []
  const d = new Date(fromDate)
  d.setHours(0, 0, 0, 0)
  const end = new Date(toDate)
  end.setHours(23, 59, 59, 999)

  while (d <= end) {
    for (const rule of scheduleConfig.rules) {
      if (matchRule(d, rule)) {
        slots.push({
          scheduledDate: new Date(d),
          scheduledTime: rule.time ?? null,
        })
      }
    }
    d.setDate(d.getDate() + 1)
  }
  return slots
}
