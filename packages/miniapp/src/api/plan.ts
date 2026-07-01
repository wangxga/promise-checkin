/**
 * Plan API — 计划管理接口
 * 对接后端 /plans 路由，只管发请求 + 类型转换
 */
import { http } from '@/http/http'
import type { Plan, PaginatedData } from '@promise-checkin/shared'

/** 计划列表查询参数 */
export interface ListPlansParams {
  type?: string
  status?: string
  keyword?: string
  page?: number
  pageSize?: number
}

/** 新建计划参数（与后端 createPlanSchema 对齐） */
export interface CreatePlanParams {
  name: string
  type: string
  color?: string
  totalCount?: number | null
  initialDoneCount?: number
  absenceConsumes?: boolean
  timeMode: string
  scheduleConfig?: { rules: Array<{ weekday?: number; every?: string; time: string }> } | null
  overdueHandling?: string
  overdueGraceHours?: number
  recordValue?: boolean
  valueUnit?: string | null
  startDate?: string
  remark?: string | null
}

export const planApi = {
  /** 计划列表 */
  list: (params: ListPlansParams = {}) =>
    http.get<PaginatedData<Plan>>('/plans', { data: params as unknown as Record<string, unknown> }),

  /** 计划详情 */
  get: (id: number) => http.get<Plan>(`/plans/${id}`),

  /** 新建 */
  create: (data: CreatePlanParams) => http.post<Plan>('/plans', data),

  /** 更新 */
  update: (id: number, data: Partial<CreatePlanParams>) => http.put<Plan>(`/plans/${id}`, data),

  /** 归档 */
  archive: (id: number) => http.patch<Plan>(`/plans/${id}/archive`),

  /** 删除（软删） */
  remove: (id: number) => http.del<null>(`/plans/${id}`),

  /** 回收站：已删除计划列表 */
  trash: () => http.get<Plan[]>('/plans/trash'),

  /** 回收站：恢复计划 */
  restore: (id: number) => http.patch<Plan>(`/plans/${id}/restore`),
}
