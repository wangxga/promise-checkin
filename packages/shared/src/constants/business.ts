/** 分页默认值 */
export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,
} as const

/** JWT 相关默认值（实际有效期由后端环境变量覆盖） */
export const JWT_DEFAULTS = {
  ACCESS_EXPIRES_SECONDS: 7 * 24 * 3600, // 7 天
  REFRESH_EXPIRES_SECONDS: 30 * 24 * 3600, // 30 天
} as const

/** 业务默认值 */
export const BUSINESS_DEFAULTS = {
  /** 默认逾期宽限期（小时） */
  DEFAULT_OVERDUE_GRACE_HOURS: 24,
  /** 默认主题色 */
  DEFAULT_PLAN_COLOR: '#007AFF',
  /** 排期预生成的未来天数窗口 */
  SCHEDULE_LOOKAHEAD_DAYS: 14,
  /** 计划名称最大长度 */
  PLAN_NAME_MAX_LENGTH: 64,
  /** 备注/请假原因最大长度 */
  REMARK_MAX_LENGTH: 255,
} as const

/** 缺席常见原因（前端快捷 chips 用，后端不做强校验） */
export const COMMON_ABSENCE_REASONS = ['生病', '外出', '遗忘', '有事', '天气'] as const
