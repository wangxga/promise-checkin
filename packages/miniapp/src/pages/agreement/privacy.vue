<script setup lang="ts">
// 隐私政策页面（微信审核必需）
</script>

<template>
  <view class="page">
    <view class="content">
      <text class="h1">隐私政策</text>
      <text class="updated">最后更新：2026年7月</text>

      <text class="h2">一、信息收集</text>
      <text class="p">
        「如约打卡」是一个个人计划打卡工具。为了提供核心功能，我们会收集以下信息：
      </text>
      <text class="p">1. 微信登录凭证（openid）：用于识别用户身份，完成登录，不包含敏感个人信息。</text>
      <text class="p">2. 昵称和头像：新用户登录后我们会生成默认昵称和默认头像。您可在「我的」页面主动设置自己的昵称和头像，设置后的头像文件会保存在服务器上用于展示。</text>
      <text class="p">
        3. 您主动创建的打卡数据（计划名称、打卡记录、备注、记录的数值等）：这些数据完全由您控制，存储在服务器上仅供您本人查看。
      </text>

      <text class="h2">二、信息使用</text>
      <text class="p">您的信息仅用于：</text>
      <text class="p">· 提供打卡、进度统计、日历查看等核心功能</text>
      <text class="p">· 在您主动操作时展示给您本人</text>
      <text class="p">我们不会将您的信息用于其他目的，也不会分享给第三方。</text>

      <text class="h2">三、信息存储与安全</text>
      <text class="p">· 您的数据存储在服务器上，通过 HTTPS 加密传输。</text>
      <text class="p">· 我们采取合理的安全措施保护您的信息不被泄露。</text>

      <text class="h2">四、信息删除</text>
      <text class="p">· 您可以随时删除计划或打卡记录，删除后数据进入回收站。</text>
      <text class="p">· 您可以退出登录清除本地缓存数据。</text>

      <text class="h2">五、未成年人保护</text>
      <text class="p">本产品适合各年龄段用户使用，不涉及未成年人不宜的内容。</text>

      <text class="h2">六、联系我们</text>
      <text class="p">如有隐私相关问题，请通过微信小程序平台的客服渠道联系我们。</text>
    </view>
  </view>
</template>

<style scoped lang="scss">
.page {
  min-height: 100vh;
  background: #fafafa;
}
.content {
  padding: 40rpx 32rpx 80rpx;
}
.h1 {
  display: block;
  font-size: 40rpx;
  font-weight: 700;
  margin-bottom: 8rpx;
}
.updated {
  display: block;
  font-size: 24rpx;
  color: #ababab;
  margin-bottom: 32rpx;
}
.h2 {
  display: block;
  font-size: 30rpx;
  font-weight: 600;
  margin-top: 32rpx;
  margin-bottom: 16rpx;
}
.p {
  display: block;
  font-size: 26rpx;
  color: #6b6b6b;
  line-height: 1.8;
  margin-bottom: 8rpx;
}
</style>
