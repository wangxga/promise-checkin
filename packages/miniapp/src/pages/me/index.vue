<script setup lang="ts">
import { ref, computed } from 'vue'
import { useUserStore } from '@/store/user'
import { authApi } from '@/api/auth'
import { uploadAvatar, resolveAssetUrl } from '@/api/upload'
import { planApi } from '@/api/plan'
import type { Plan } from '@promise-checkin/shared'

const userStore = useUserStore()
const trashPlans = ref<Plan[]>([])
const showTrash = ref(false)
const showNicknamePopup = ref(false)
const editNickname = ref('')
const savingNickname = ref(false)
const avatarUploading = ref(false)

/** 是否已设置自定义头像（非默认头像） */
const isCustomAvatar = computed(() => {
  const url = userStore.profile?.avatarUrl
  return !!url && !url.endsWith('default-avatar.png')
})

/** 头像展示 URL：DB 存相对路径（/uploads/...），拼上站点根才能被 <image> 加载 */
const avatarSrc = computed(() => {
  const url = userStore.profile?.avatarUrl
  return url ? resolveAssetUrl(url) : ''
})

/**
 * 选择头像：微信官方 chooseAvatar 组件回调
 * 流程：拿临时路径 → 上传服务器拿真实 URL → 写回 DB
 * 临时路径不能直接存（重启失效），必须上传
 */
async function onChooseAvatar(e: { detail: { avatarUrl: string } }) {
  if (avatarUploading.value) return
  const tempUrl = e.detail.avatarUrl
  if (!tempUrl) return
  avatarUploading.value = true
  uni.showLoading({ title: '上传中...', mask: true })
  try {
    // 1. 上传到服务器，拿持久化 URL
    const serverUrl = await uploadAvatar(tempUrl)
    // 2. 写回用户表
    await authApi.updateProfile({ avatarUrl: serverUrl })
    // 3. 乐观更新 store
    if (userStore.profile) {
      userStore.profile.avatarUrl = serverUrl
    }
    uni.hideLoading()
    uni.showToast({ title: '头像已更新', icon: 'success' })
  } catch (err) {
    uni.hideLoading()
    uni.showToast({
      title: err instanceof Error ? err.message : '头像更新失败',
      icon: 'none',
    })
  } finally {
    avatarUploading.value = false
  }
}

/** 打开昵称编辑弹窗 */
function openNicknamePopup() {
  editNickname.value = userStore.profile?.nickname || ''
  showNicknamePopup.value = true
}

/** 保存昵称（由弹窗的"保存"按钮触发） */
async function saveNickname() {
  const nickname = editNickname.value.trim()
  if (!nickname) {
    uni.showToast({ title: '昵称不能为空', icon: 'none' })
    return
  }
  if (savingNickname.value) return
  savingNickname.value = true
  // 保存前先收起键盘，避免微信昵称推荐条残留遮挡底部菜单
  uni.hideKeyboard()
  try {
    await authApi.updateProfile({ nickname })
    if (userStore.profile) {
      userStore.profile.nickname = nickname
    }
    showNicknamePopup.value = false
    uni.showToast({ title: '昵称已更新', icon: 'success' })
  } catch {
    uni.showToast({ title: '更新失败', icon: 'none' })
  } finally {
    savingNickname.value = false
  }
}

/** 取消编辑昵称（也收起键盘） */
function cancelNickname() {
  uni.hideKeyboard()
  showNicknamePopup.value = false
  editNickname.value = ''
}

function handleLogout() {
  uni.showModal({
    title: '确认退出登录？',
    success: (res) => {
      if (res.confirm) userStore.logout()
    },
  })
}

/** 打开回收站 */
async function openTrash() {
  try {
    trashPlans.value = await planApi.trash()
    showTrash.value = true
  } catch (e) {
    uni.showToast({ title: e instanceof Error ? e.message : '加载失败', icon: 'none' })
  }
}

/** 恢复计划 */
async function handleRestore(id: number) {
  try {
    await planApi.restore(id)
    trashPlans.value = trashPlans.value.filter((p) => p.id !== id)
    uni.showToast({ title: '已恢复', icon: 'success' })
    if (!trashPlans.value.length) showTrash.value = false
  } catch (e) {
    uni.showToast({ title: e instanceof Error ? e.message : '恢复失败', icon: 'none' })
  }
}
</script>

<template>
  <view class="page">
    <view class="profile-card">
      <view class="avatar-col">
        <!-- 微信官方头像组件：open-type="chooseAvatar" 弹微信原生选图弹窗 -->
        <button
          class="avatar-btn"
          open-type="chooseAvatar"
          :disabled="avatarUploading"
          @chooseavatar="onChooseAvatar"
        >
          <image
            v-if="userStore.profile?.avatarUrl"
            class="avatar"
            :src="avatarSrc"
            mode="aspectFill"
          />
          <view v-else class="avatar-default">
            <text class="avatar-placeholder">👤</text>
          </view>
          <!-- 自定义头像才显示"换"角标 -->
          <view v-if="isCustomAvatar" class="avatar-edit-hint">换</view>
        </button>
        <!-- 默认头像时引导用户去设置 -->
        <text v-if="!isCustomAvatar" class="avatar-tip">点头像设置</text>
      </view>
      <view class="info">
        <view class="nickname-row" @click="openNicknamePopup">
          <text class="nickname">{{ userStore.profile?.nickname || '未设置昵称' }}</text>
          <text class="edit-icon">✎</text>
        </view>
      </view>
    </view>

    <view class="section">
      <view class="item" @click="openTrash">
        <text class="item-text">回收站</text>
        <text class="arrow">›</text>
      </view>
      <view class="item" @click="handleLogout">
        <text class="item-text danger">退出登录</text>
        <text class="arrow">›</text>
      </view>
    </view>

    <!-- 回收站弹窗 -->
    <wd-popup v-model="showTrash" position="bottom" :safe-area-inset-bottom="true" custom-style="border-radius: 24rpx 24rpx 0 0">
      <view class="trash-panel">
        <view class="trash-head">
          <text class="trash-title">回收站</text>
          <text class="trash-close" @click="showTrash = false">✕</text>
        </view>
        <view v-if="trashPlans.length" class="trash-list">
          <view v-for="p in trashPlans" :key="p.id" class="trash-item">
            <view class="trash-info">
              <text class="trash-name">{{ p.name }}</text>
              <text class="trash-date">删除于 {{ (p.deletedAt || '').slice(0, 10) }}</text>
            </view>
            <wd-button type="primary" size="small" plain @click="handleRestore(p.id)">恢复</wd-button>
          </view>
        </view>
        <view v-else class="trash-empty">
          <text>回收站是空的</text>
        </view>
      </view>
    </wd-popup>

    <!-- 昵称编辑弹窗 -->
    <wd-popup v-model="showNicknamePopup" position="bottom" :safe-area-inset-bottom="true" custom-style="border-radius: 24rpx 24rpx 0 0">
      <view class="nickname-panel">
        <view class="nickname-head">
          <text class="nickname-cancel" @click="cancelNickname">取消</text>
          <text class="nickname-title">设置昵称</text>
          <text class="nickname-save" :class="{ disabled: savingNickname }" @click="saveNickname">保存</text>
        </view>
        <view class="nickname-input-wrap">
          <input
            class="nickname-input"
            type="nickname"
            :value="editNickname"
            placeholder="请输入昵称"
            :maxlength="20"
            :focus="showNicknamePopup"
            @input="editNickname = ($event as UniInputEvent).detail.value"
          />
        </view>
        <text class="nickname-hint">输入昵称后点击「保存」，键盘会推荐你的微信昵称</text>
      </view>
    </wd-popup>

    <view class="about">
      <text class="about-text">© 2026 如约打卡</text>
    </view>
  </view>
</template>

<style scoped lang="scss">
.page {
  min-height: 100vh;
  padding: 32rpx;
}
.profile-card {
  display: flex;
  align-items: center;
  gap: 24rpx;
  padding: 40rpx 32rpx;
  background: #fff;
  border-radius: 24rpx;
  margin-bottom: 32rpx;
}
.avatar-col {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8rpx;
  flex-shrink: 0;
}
.avatar-btn {
  position: relative;
  width: 120rpx;
  height: 120rpx;
  padding: 0;
  margin: 0;
  border: none;
  background: transparent;
  line-height: normal;
}
.avatar-btn::after { border: none; }
.avatar {
  width: 120rpx;
  height: 120rpx;
  border-radius: 50%;
  background: #f0f0f0;
}
.avatar-default {
  width: 120rpx;
  height: 120rpx;
  border-radius: 50%;
  background: #e0e0e0;
  display: flex;
  align-items: center;
  justify-content: center;
}
.avatar-placeholder {
  font-size: 48rpx;
}
.avatar-edit-hint {
  position: absolute;
  right: 0;
  bottom: 0;
  width: 40rpx;
  height: 40rpx;
  border-radius: 50%;
  background: #1a1a1a;
  color: #fff;
  font-size: 20rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}
.avatar-tip {
  font-size: 20rpx;
  color: #ababab;
}
.nickname-row {
  display: flex;
  align-items: center;
  gap: 12rpx;
}
.edit-icon {
  font-size: 24rpx;
  color: #ababab;
}
.info {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}
.nickname {
  font-size: 36rpx;
  font-weight: 600;
}
.section {
  background: #fff;
  border-radius: 24rpx;
  overflow: hidden;
}
.item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 32rpx;
}
.item-text {
  font-size: 30rpx;
}
.danger {
  color: #ff3b30;
}
.arrow {
  color: #ababab;
}
.about {
  margin-top: 48rpx;
  text-align: center;
}
.about-text {
  font-size: 22rpx;
  color: #ababab;
}
.trash-panel {
  padding: 32rpx;
  max-height: 70vh;
  overflow-y: auto;
}
.trash-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24rpx;
}
.trash-title {
  font-size: 34rpx;
  font-weight: 600;
}
.trash-close {
  font-size: 32rpx;
  color: #ababab;
  padding: 8rpx 16rpx;
}
.trash-list {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}
.trash-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 24rpx;
  background: #f9f9f9;
  border-radius: 16rpx;
}
.trash-info {
  display: flex;
  flex-direction: column;
  gap: 6rpx;
}
.trash-name {
  font-size: 28rpx;
  font-weight: 500;
}
.trash-date {
  font-size: 22rpx;
  color: #ababab;
}
.trash-empty {
  text-align: center;
  padding: 80rpx 0;
  color: #ababab;
  font-size: 28rpx;
}
.nickname-panel {
  padding: 32rpx;
}
.nickname-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 32rpx;
}
.nickname-cancel {
  font-size: 28rpx;
  color: #ababab;
  padding: 8rpx 16rpx;
}
.nickname-title {
  font-size: 34rpx;
  font-weight: 600;
}
.nickname-save {
  font-size: 28rpx;
  color: #1a1a1a;
  font-weight: 600;
  padding: 8rpx 16rpx;
}
.nickname-save.disabled {
  color: #c0c0c0;
}
.nickname-input-wrap {
  background: #f5f5f5;
  border-radius: 16rpx;
  padding: 24rpx;
  margin-bottom: 16rpx;
}
.nickname-input {
  font-size: 32rpx;
  width: 100%;
}
.nickname-hint {
  font-size: 22rpx;
  color: #ababab;
  line-height: 1.6;
}
</style>
