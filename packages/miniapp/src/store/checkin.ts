import { ref } from 'vue'
/**
 * Checkin Store — 今日打卡数据
 * 缓存首页概览（今日待办/已完成），提供打卡操作
 */
import { defineStore } from 'pinia'
import { statsApi, type OverviewData } from '@/api/stats'
import { checkinApi, type UpsertCheckinParams } from '@/api/checkin'

export const useCheckinStore = defineStore('checkin', () => {
  const overview = ref<OverviewData | null>(null)
  const loading = ref(false)

  /** 拉取首页概览 */
  async function fetchOverview() {
    loading.value = true
    try {
      overview.value = await statsApi.overview()
    } finally {
      loading.value = false
    }
  }

  /**
   * 一键打卡（标记完成）
   * 打卡后本地更新概览（todo-1, done+1），避免重新拉取
   */
  async function quickDone(
    planId: number,
    scheduledDate: string,
    scheduledTime: string | null,
    value?: number,
  ) {
    const data: UpsertCheckinParams = {
      scheduledDate,
      scheduledTime,
      status: 'done',
      ...(value !== undefined ? { value } : {}),
    }
    await checkinApi.upsert(planId, data)
    // 本地更新：从待办移到已完成
    if (overview.value) {
      const item = overview.value.todayTodoList.find(
        (t) => t.planId === planId && t.scheduledDate === scheduledDate && t.scheduledTime === scheduledTime,
      )
      if (item) {
        overview.value.todayTodoList = overview.value.todayTodoList.filter((t) => t !== item)
        overview.value.todayDoneList.unshift({
          checkinId: item.checkinId,
          planId: item.planId,
          planName: item.planName,
          scheduledTime: item.scheduledTime,
        })
        overview.value.todayTodo--
        overview.value.todayDone++
      }
    }
  }

  return { overview, loading, fetchOverview, quickDone }
})
