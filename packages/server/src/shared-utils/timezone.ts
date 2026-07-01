/**
 * 时区工具
 *
 * 核心问题：服务器可能跑在 UTC 时区（如 Docker 容器），但打卡的"今天"应按用户本地时区（Asia/Shanghai）计算。
 * 不依赖进程的 TZ 环境变量，所有时间判断显式用上海时区（UTC+8）。
 *
 * 设计：所有需要"今天/本周"的判断都调这里的函数，不直接用 new Date() + setHours()。
 */

const SHANGHAI_OFFSET_MS = 8 * 60 * 60 * 1000 // UTC+8

/** 当前时刻的 Date 对象（UTC） */
export function now(): Date {
  return new Date()
}

/** 当前上海时间（返回一个"看起来是上海本地时间"的 Date，实际是 UTC+8 偏移后的 Date） */
export function shanghaiNow(): Date {
  return new Date(Date.now() + SHANGHAI_OFFSET_MS)
}

/**
 * 上海时区的"今天"日期，返回 YYYY-MM-DD
 * 用于查 checkins.scheduled_date（本地时区日期）
 */
export function shanghaiTodayStr(): string {
  return shanghaiDateStr(new Date())
}

/**
 * 任意 UTC Date → 上海时区的 YYYY-MM-DD
 */
export function shanghaiDateStr(utcDate: Date): string {
  const sh = new Date(utcDate.getTime() + SHANGHAI_OFFSET_MS)
  const y = sh.getUTCFullYear()
  const m = String(sh.getUTCMonth() + 1).padStart(2, '0')
  const d = String(sh.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/**
 * 上海时区的"今天"起止区间 [todayStart, todayEnd)
 * 返回 UTC Date 对象，可直接用于 Prisma 的 scheduledDate gte/lt 比较
 *
 * 注意：scheduledDate 是 @db.Date（无时间），Prisma 读取时按连接时区构造。
 * 但查询时传 gte/lt 用 UTC Date 对象，MySQL 会正确处理 DATE 比较。
 * 这里用上海"今天的 0 点"对应的 UTC 时刻作为边界。
 */
export function shanghaiTodayRange(): { start: Date; end: Date } {
  const sh = shanghaiNow()
  const y = sh.getUTCFullYear()
  const m = sh.getUTCMonth()
  const d = sh.getUTCDate()
  // 上海今天 0 点 = UTC 减 8 小时
  const startUtc = new Date(Date.UTC(y, m, d) - SHANGHAI_OFFSET_MS)
  const endUtc = new Date(startUtc.getTime() + 24 * 60 * 60 * 1000)
  return { start: startUtc, end: endUtc }
}

/**
 * 把上海时区的日期字符串 YYYY-MM-DD + 时间 HH:mm + 额外小时数 → UTC Date
 * 用于逾期扫描的 deadline 计算
 */
export function shanghaiDeadline(dateStr: string, time: string | null, extraHours: number): Date {
  const [y, m, d] = dateStr.split('-').map(Number)
  if (time) {
    const [hh, mm] = time.split(':').map(Number)
    // 上海时间 YYYY-MM-DD HH:mm → UTC
    return new Date(Date.UTC(y, m - 1, d, hh, mm, 0) - SHANGHAI_OFFSET_MS + extraHours * 3600 * 1000)
  }
  // 无时间：当天 23:59:59 上海时间
  return new Date(Date.UTC(y, m - 1, d, 23, 59, 59) - SHANGHAI_OFFSET_MS + extraHours * 3600 * 1000)
}
