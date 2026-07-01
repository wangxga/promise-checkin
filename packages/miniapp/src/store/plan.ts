/**
 * Plan Store — 计划列表缓存与操作
 * 管理 active 计划列表，提供刷新/增删改的 action
 */
import { defineStore } from 'pinia'
import type { Plan } from '@promise-checkin/shared'
import { planApi, type CreatePlanParams } from '@/api/plan'

export const usePlanStore = defineStore('plan', () => {
  const plans = ref<Plan[]>([])
  const loading = ref(false)

  /** 拉取进行中计划列表 */
  async function fetchPlans(status = 'active') {
    loading.value = true
    try {
      const res = await planApi.list({ status })
      plans.value = res.list
    } finally {
      loading.value = false
    }
  }

  /** 新建计划（成功后加入列表） */
  async function createPlan(data: CreatePlanParams) {
    const plan = await planApi.create(data)
    plans.value.unshift(plan)
    return plan
  }

  /** 更新计划（同步列表中的对应项） */
  async function updatePlan(id: number, data: Partial<CreatePlanParams>) {
    const plan = await planApi.update(id, data)
    const idx = plans.value.findIndex((p) => p.id === id)
    if (idx >= 0) plans.value[idx] = plan
    return plan
  }

  /** 归档（从列表移除） */
  async function archivePlan(id: number) {
    await planApi.archive(id)
    plans.value = plans.value.filter((p) => p.id !== id)
  }

  /** 删除（从列表移除） */
  async function deletePlan(id: number) {
    await planApi.remove(id)
    plans.value = plans.value.filter((p) => p.id !== id)
  }

  return { plans, loading, fetchPlans, createPlan, updatePlan, archivePlan, deletePlan }
})
