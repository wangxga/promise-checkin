/**
 * PM2 进程配置
 *
 * 用法：
 *   开发：pnpm dev（tsx watch，不用 PM2）
 *   生产：
 *     cd packages/server
 *     pnpm build
 *     pm2 start ecosystem.config.cjs --env production
 *     pm2 save && pm2 startup（开机自启）
 */
module.exports = {
  apps: [
    {
      name: 'promise-checkin-api',
      script: 'dist/app.js',
      instances: 1, // 单实例（多实例需处理 Redis 共享 + 定时任务去重）
      exec_mode: 'fork',
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'development',
      },
      env_production: {
        NODE_ENV: 'production',
      },
      // 日志（PM2 自带日志管理，按日轮转需配合 pm2-logrotate）
      error_file: '/var/log/promise-checkin/err.log',
      out_file: '/var/log/promise-checkin/out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      merge_logs: true,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 3000,
    },
  ],
}
