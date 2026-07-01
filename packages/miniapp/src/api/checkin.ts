/**
 * Checkin API — 打卡接口
 * 对接后端 /plans/:planId/checkins 和 /checkins/:id 路由
 */
import { http } from '@/http/http'
import type { Checkin } from '@promise-checkin/shared'

/** 打卡 upsert 参数 */
export interface UpsertCheckinParams {
  scheduledDate: string
  scheduledTime?: string | null
  status: 'done' | 'missed' | 'pending'
  value?: number | null
  remark?: string | null
}

/** 日历响应 */
export interface CalendarResult {
  month: string
  days: Checkin[]
}

export const checkinApi = {
  /** 计划的打卡列表 */
  list: (
    planId: number,
    params: { startDate?: string; endDate?: string; status?: string } = {},
  ) =>
    http.get<Checkin[]>(`/plans/${planId}/checkins`, {
      data: params as unknown as Record<string, unknown>,
    }),

  /** 日历视图 */
  calendar: (planId: number, month?: string) =>
    http.get<CalendarResult>(`/plans/${planId}/checkins/calendar`, {
      data: month ? { month } : undefined,
    }),

  /** upsert 打卡（标记完成/请假） */
  upsert: (planId: number, data: UpsertCheckinParams) =>
    http.post<Checkin>(`/plans/${planId}/checkins`, data),

  /** 补录（事后补 done） */
  retroactive: (
    planId: number,
    data: { scheduledDate: string; scheduledTime?: string | null; value?: number | null },
  ) => http.post<Checkin>(`/plans/${planId}/checkins/retroactive`, data),

  /** 详情 */
  get: (id: number) => http.get<Checkin>(`/checkins/${id}`),

  /** 改状态 */
  update: (
    id: number,
    data: { status?: 'done' | 'missed' | 'pending'; value?: number | null; remark?: string | null },
  ) => http.patch<Checkin>(`/checkins/${id}`, data),

  /** 调整排期 */
  reschedule: (id: number, data: { newDate: string; newTime?: string | null }) =>
    http.post<Checkin>(`/checkins/${id}/reschedule`, data),

  /** 删除 */
  remove: (id: number) => http.del<null>(`/checkins/${id}`),
}
