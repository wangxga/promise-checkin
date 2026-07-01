/**
 * 页面路由全局配置 → 插件自动生成 pages.json
 * 页面级配置也写在各 .vue 的 <route> 块里
 *
 * TabBar 三栏（新设计）：
 *   今日 = 纯打卡操作
 *   计划 = 计划列表 + 新增入口（标题栏「+」）
 *   我的 = 个人中心
 */
export default {
  easycom: {
    autoscan: true,
    custom: {
      // wot-design-uni 组件自动引入（npm 安装方式需配 easycom 规则）
      '^wd-(.*)': 'wot-design-uni/components/wd-$1/wd-$1.vue',
    },
  },
  pages: [
    { path: 'pages/today/index', style: { navigationBarTitleText: '今日' } },
    { path: 'pages/plan/index', style: { navigationBarTitleText: '计划' } },
    { path: 'pages/me/index', style: { navigationBarTitleText: '我的' } },
    { path: 'pages/login/index', style: { navigationBarTitleText: '登录' } },
    { path: 'pages/plan/detail', style: { navigationBarTitleText: '计划详情' } },
    { path: 'pages/plan/edit', style: { navigationBarTitleText: '新建计划' } },
    { path: 'pages/stats/missed', style: { navigationBarTitleText: '缺席记录' } },
    { path: 'pages/agreement/privacy', style: { navigationBarTitleText: '隐私政策' } },
  ],
  globalStyle: {
    navigationBarTextStyle: 'black',
    navigationBarBackgroundColor: '#FAFAFA',
    backgroundColor: '#FAFAFA',
  },
  tabBar: {
    color: '#ababab',
    selectedColor: '#1a1a1a',
    backgroundColor: '#FFFFFF',
    borderStyle: 'white',
    list: [
      { pagePath: 'pages/today/index', text: '今日' },
      { pagePath: 'pages/plan/index', text: '计划' },
      { pagePath: 'pages/me/index', text: '我的' },
    ],
  },
}
