/**
 * 计划类型枚举
 * 通用化：每个类型对应一种图标和默认配置，但不绑定死业务规则
 */
export enum PlanType {
  /** 课程（兴趣班） */
  COURSE = 'course',
  /** 服药 */
  MEDICINE = 'medicine',
  /** 测量（血压/血糖等，通常记录数值） */
  MEASURE = 'measure',
  /** 运动/健身 */
  FITNESS = 'fitness',
  /** 学习（背单词等） */
  LEARNING = 'learning',
  /** 自定义 */
  CUSTOM = 'custom',
}

/** 时间模式 */
export enum TimeMode {
  /** 固定排期（系统按 scheduleConfig 预生成打卡槽位） */
  FIXED = 'fixed',
  /** 不固定（用户随时手动打卡，无预生成排期） */
  FLEXIBLE = 'flexible',
}

/** 固定排期的子类型 */
export enum ScheduleType {
  /** 按周几 */
  WEEKDAY = 'weekday',
  /** 每天定时 */
  EVERYDAY = 'everyday',
}

/** 计划状态 */
export enum PlanStatus {
  ACTIVE = 'active',
  ARCHIVED = 'archived',
  COMPLETED = 'completed',
}

/** 逾期处理策略 */
export enum OverdueHandling {
  /** 保留待处理（pending 不自动变化） */
  KEEP_PENDING = 'keep_pending',
  /** 超过宽限期后自动标记为缺席 */
  AUTO_MISSED = 'auto_missed',
}
