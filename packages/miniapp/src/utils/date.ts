/**
 * 日期工具函数
 * 与后端约定：scheduledDate 始终是用户本地时区日期 YYYY-MM-DD，不参与 UTC 换算
 */

const pad = (n: number): string => String(n).padStart(2, '0')

/** Date → YYYY-MM-DD（本地时区） */
export function formatDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** 当前日期 YYYY-MM-DD */
export function todayStr(): string {
  return formatDate(new Date())
}

/** 加减天数 */
export function addDays(date: Date, n: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + n)
  return d
}

/** ISO 周几 1-7（1=周一，7=周日） */
export function isoWeekday(d: Date): number {
  return d.getDay() === 0 ? 7 : d.getDay()
}

/** 周几中文 */
export function weekdayCN(w: number): string {
  return ['', '一', '二', '三', '四', '五', '六', '日'][w]
}

/** 当前月份 YYYY-MM */
export function currentMonth(): string {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`
}

/** 月份偏移：month=2026-07, offset=1 → 2026-08 */
export function shiftMonth(month: string, offset: number): string {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(y, m - 1 + offset, 1)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`
}

/** 某月的日期网格（含前后空位补齐，返回 Date 数组，null 表示空位） */
export function monthGrid(month: string): (Date | null)[] {
  const [y, m] = month.split('-').map(Number)
  const first = new Date(y, m - 1, 1)
  const firstDow = first.getDay() === 0 ? 6 : first.getDay() - 1 // 周一为首
  const daysInMonth = new Date(y, m, 0).getDate()
  const grid: (Date | null)[] = []
  for (let i = 0; i < firstDow; i++) grid.push(null)
  for (let d = 1; d <= daysInMonth; d++) grid.push(new Date(y, m - 1, d))
  return grid
}
