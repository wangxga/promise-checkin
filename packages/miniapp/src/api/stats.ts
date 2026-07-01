/**
 * Stats API — 统计接口
 * 对接后端 /stats 和 /plans/:id/progress 路由
 */
import { http } from '@/http/http'
import type { PlanProgress, PaginatedData, Checkin } from '@promise-checkin/shared'

/** 首页概览数据 */
export interface OverviewData {
  totalPlans: number
  todayTodo: number
  todayDone: number
  weekMissed: number
  todayTodoList: Array<{
    checkinId: number
    planId: number
    planName: string
    planColor: string
    recordValue: boolean
    valueUnit: string | null
    scheduledDate: string
    scheduledTime: string | null
  }>
  todayDoneList: Array<{
    checkinId: number
    planId: number
    planName: string
    scheduledTime: string | null
  }>
}

/** 计划进度（含 streak/completionRate 等） */
export type PlanProgressData = PlanProgress & {
  doneCount: number
  missedCount: number
  streak: number
  completionRate: number | null
  estimatedEndDate: string | null
}

/** 缺席列表项 */
export interface MissedItem extends Checkin {
  planName: string
  planColor: string
}

export const statsApi = {
  /** 首页概览 */
  overview: () => http.get<OverviewData>('/stats/overview'),

  /** 计划进度 */
  progress: (planId: number) => http.get<PlanProgressData>(`/plans/${planId}/progress`),

  /** 缺席列表 */
  missed: (params: { planId?: number; page?: number; pageSize?: number } = {}) =>
    http.get<PaginatedData<MissedItem>>('/stats/missed', {
      data: params as unknown as Record<string, unknown>,
    }),

  /** 数值趋势数据（recordValue 计划用） */
  values: (planId: number, limit = 30) =>
    http.get<{ unit: string | null; values: Array<{ date: string; value: number }> }>(
      `/plans/${planId}/values`,
      { data: { limit } as unknown as Record<string, unknown> },
    ),
}
