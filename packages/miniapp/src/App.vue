<script setup lang="ts">
import { onLaunch } from '@dcloudio/uni-app'
import { useUserStore } from '@/store/user'

onLaunch(() => {
  // 启动时恢复登录态，若无 token 则路由守卫会跳登录页
  const userStore = useUserStore()
  userStore.restoreToken()
})
</script>

<style lang="scss">
/* 全局样式：引入 wot-design-uni 基础样式 + 项目主题变量 */
@import 'wot-design-uni/components/common/abstracts/variable.scss';
@import 'wot-design-uni/components/common/abstracts/mixin.scss';

page {
  background-color: #fafafa;
  color: #1a1a1a;
  font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Helvetica Neue', sans-serif;
  font-size: 28rpx;
}
</style>
