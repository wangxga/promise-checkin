import type { Plan } from '@promise-checkin/shared'

/**
 * 计划进度派生工具（从 demo 移植）
 * 多口径计数：consumed = initialDoneCount + doneCount + (absenceConsumes ? missedCount : 0)
 * 页面/composable 调这些函数，不直接算
 */

/** 总已完成 = initialDoneCount + doneCount */
export function totalDone(plan: Pick<Plan, 'initialDoneCount' | 'doneCount'>): number {
  return (plan.initialDoneCount || 0) + (plan.doneCount || 0)
}

/** 已消耗配额（无限计划返回 null） */
export function consumed(plan: Pick<Plan, 'totalCount' | 'initialDoneCount' | 'doneCount' | 'missedCount' | 'absenceConsumes'>): number | null {
  if (plan.totalCount === null || plan.totalCount === undefined) return null
  return totalDone(plan) + (plan.absenceConsumes ? plan.missedCount : 0)
}

/** 剩余配额（无限计划返回 null） */
export function remain(plan: Pick<Plan, 'totalCount' | 'initialDoneCount' | 'doneCount' | 'missedCount' | 'absenceConsumes'>): number | null {
  if (plan.totalCount === null || plan.totalCount === undefined) return null
  return plan.totalCount - (consumed(plan) as number)
}

/** 进度 0~1（无限计划返回 null） */
export function progress(plan: Pick<Plan, 'totalCount' | 'initialDoneCount' | 'doneCount' | 'missedCount' | 'absenceConsumes'>): number | null {
  if (plan.totalCount === null || plan.totalCount === undefined) return null
  const c = consumed(plan) as number
  return plan.totalCount > 0 ? c / plan.totalCount : 0
}

/** 进度百分比字符串（0%~100%） */
export function progressText(plan: Pick<Plan, 'totalCount' | 'initialDoneCount' | 'doneCount' | 'missedCount' | 'absenceConsumes'>): string {
  const p = progress(plan)
  return p === null ? '—' : `${Math.round(p * 100)}%`
}
