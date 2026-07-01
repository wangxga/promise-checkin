import { PrismaClient } from '@prisma/client'

/**
 * 开发种子数据
 * 1. dev 用户（openid 与 lib/devtool.ts 的 DEV_MOCK_OPENID 一致）
 * 2. 3 个示例计划（复用 demo 数据：钢琴课/每日维生素/量血压）
 * 3. 历史打卡记录（含 done/missed/pending，便于前端联调看效果）
 *
 * 跑法：pnpm db:seed
 */
const prisma = new PrismaClient()

/** 日期工具 */
function daysAgo(n: number): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - n)
  return d
}
function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}
function isoWeekday(d: Date): number {
  return d.getDay() === 0 ? 7 : d.getDay()
}

async function main() {
  // 1. dev 用户
  const user = await prisma.user.upsert({
    where: { openid: 'dev-mock-openid-123456' },
    update: {},
    create: {
      openid: 'dev-mock-openid-123456',
      nickname: '开发者',
      status: 1,
      lastLoginAt: new Date(),
    },
  })
  console.log(`✅ 用户: id=${user.id} 昵称=${user.nickname}`)

  // 清理旧示例数据（按 name 匹配，避免重复）
  await prisma.checkin.deleteMany({ where: { plan: { userId: user.id } } })
  await prisma.plan.deleteMany({ where: { userId: user.id } })

  const uid = user.id

  // 2. 计划 1：钢琴课（60次，起始18，固定周二/六，缺勤不计消耗）
  const piano = await prisma.plan.create({
    data: {
      userId: uid,
      name: '钢琴课',
      type: 'course',
      color: '#AF52DE',
      totalCount: 60,
      initialDoneCount: 18,
      absenceConsumes: false,
      timeMode: 'fixed',
      scheduleConfig: { rules: [{ weekday: 2, time: '18:00' }, { weekday: 6, time: '10:00' }] },
      overdueHandling: 'keep_pending',
      startDate: daysAgo(42),
      status: 'active',
      remark: '周老师',
    },
  })

  // 计划 2：每日维生素（90次，缺勤计消耗，逾期自动转 missed 24h）
  const vitamin = await prisma.plan.create({
    data: {
      userId: uid,
      name: '每日维生素',
      type: 'medicine',
      color: '#34C759',
      totalCount: 90,
      absenceConsumes: true,
      timeMode: 'fixed',
      scheduleConfig: { rules: [{ every: 'day', time: '08:00' }] },
      overdueHandling: 'auto_missed',
      overdueGraceHours: 24,
      startDate: daysAgo(20),
      status: 'active',
      remark: '早餐后',
    },
  })

  // 计划 3：量血压（无限次，每日2次，记录数值 mmHg，逾期12h）
  const bp = await prisma.plan.create({
    data: {
      userId: uid,
      name: '量血压',
      type: 'measure',
      color: '#FF3B30',
      totalCount: null,
      timeMode: 'fixed',
      scheduleConfig: { rules: [{ every: 'day', time: '08:00' }, { every: 'day', time: '20:00' }] },
      overdueHandling: 'auto_missed',
      overdueGraceHours: 12,
      recordValue: true,
      valueUnit: 'mmHg',
      startDate: daysAgo(10),
      status: 'active',
      remark: '收缩压',
    },
  })

  console.log(`✅ 计划: 钢琴课(id=${piano.id}) / 每日维生素(id=${vitamin.id}) / 量血压(id=${bp.id})`)

  // 3. 生成历史打卡记录
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  let checkinCount = 0

  // 钢琴课：过去 6 周的周二/六记录，含 1 个 missed
  for (let i = 42; i >= 1; i--) {
    const d = daysAgo(i)
    const wd = isoWeekday(d)
    if (wd === 2 || wd === 6) {
      const time = wd === 2 ? '18:00' : '10:00'
      // 7天前那次标记为请假
      if (i === 7) {
        await prisma.checkin.create({
          data: {
            planId: piano.id, userId: uid,
            scheduledDate: d, scheduledTime: time,
            status: 'missed', remark: '生病发烧',
          },
        })
        checkinCount++
      } else if (i > 1) {
        await prisma.checkin.create({
          data: {
            planId: piano.id, userId: uid,
            scheduledDate: d, scheduledTime: time,
            status: 'done', actualTime: new Date(d.getTime() + 18 * 3600 * 1000),
          },
        })
        checkinCount++
      }
    }
  }

  // 维生素：过去 19 天每天 08:00，留 3 天前 pending 演示逾期
  for (let i = 19; i >= 1; i--) {
    const d = daysAgo(i)
    if (i === 3) continue // 留 pending 演示逾期
    await prisma.checkin.create({
      data: {
        planId: vitamin.id, userId: uid,
        scheduledDate: d, scheduledTime: '08:00',
        status: 'done', actualTime: new Date(d.getTime() + 8 * 3600 * 1000),
      },
    })
    checkinCount++
  }

  // 量血压：过去 9 天每天 2 次（带数值）
  for (let i = 9; i >= 1; i--) {
    const d = daysAgo(i)
    for (const t of ['08:00', '20:00']) {
      // 2天前晚上留 pending
      if (i === 2 && t === '20:00') continue
      await prisma.checkin.create({
        data: {
          planId: bp.id, userId: uid,
          scheduledDate: d, scheduledTime: t,
          status: 'done',
          actualTime: new Date(d.getTime() + (t === '08:00' ? 8 : 20) * 3600 * 1000),
          value: Math.round(115 + Math.random() * 20),
        },
      })
      checkinCount++
    }
  }

  console.log(`✅ 打卡记录: ${checkinCount} 条`)

  // 4. 同步计数（让 doneCount/missedCount 正确）
  for (const plan of [piano, vitamin, bp]) {
    const [doneCount, missedCount] = await Promise.all([
      prisma.checkin.count({ where: { planId: plan.id, status: 'done' } }),
      prisma.checkin.count({ where: { planId: plan.id, status: 'missed' } }),
    ])
    await prisma.plan.update({ where: { id: plan.id }, data: { doneCount, missedCount } })
  }
  console.log('✅ 计数已同步')
}

main()
  .then(() => console.log('🌱 seed 完成'))
  .catch((e) => {
    console.error('❌ seed 失败:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
