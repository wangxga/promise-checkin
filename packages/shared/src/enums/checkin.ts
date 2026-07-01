/**
 * 打卡记录状态
 */
export enum CheckinStatus {
  /** 已完成（实时打卡或补录） */
  DONE = 'done',
  /** 缺席/请假未去（需备注原因） */
  MISSED = 'missed',
  /** 待打卡（系统生成的排期槽位，用户尚未操作） */
  PENDING = 'pending',
}

/**
 * 打卡记录来源（区分实时打卡 vs 事后补录）
 */
export enum CheckinSource {
  /** 按排期正常打卡（实时） */
  SCHEDULED = 'scheduled',
  /** 事后补录（用户补打过去某天） */
  RETROACTIVE = 'retroactive',
}

/**
 * 打卡调整类型（标记一条记录是否经过调整）
 */
export enum AdjustmentType {
  /** 调整排期（改了原定的日期/时间，original_scheduled_* 保留原值） */
  RESCHEDULE = 'reschedule',
  /** 补打为已完成（从 missed 转为 done 的补录） */
  MAKEUP = 'makeup',
}
