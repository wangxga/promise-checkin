<script setup lang="ts">
import { ref } from 'vue'
import { useUserStore } from '@/store/user'
import { authApi } from '@/api/auth'
import { planApi } from '@/api/plan'
import type { Plan } from '@promise-checkin/shared'

const userStore = useUserStore()
const trashPlans = ref<Plan[]>([])
const showTrash = ref(false)
const editingProfile = ref(false)
const editNickname = ref('')

/** 选择头像（从相册/拍照选图） */
async function onChooseAvatar() {
  try {
    const res = await uni.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      sizeType: ['compressed'],
    })
    const tempUrl = res.tempFiles[0].tempFilePath
    // 先更新 store 本地显示，再提交后端
    if (userStore.profile) {
      userStore.profile.avatarUrl = tempUrl
    }
    await authApi.updateProfile({ avatarUrl: tempUrl })
    uni.showToast({ title: '头像已更新', icon: 'success' })
  } catch {
    // 用户取消不提示
  }
}

/** 昵称输入完成 */
async function onNicknameConfirm(e: { detail: { value: string } }) {
  const nickname = e.detail.value.trim()
  if (!nickname) return
  try {
    await authApi.updateProfile({ nickname })
    if (userStore.profile) {
      userStore.profile.nickname = nickname
    }
    editingProfile.value = false
    uni.showToast({ title: '昵称已更新', icon: 'success' })
  } catch {
    uni.showToast({ title: '更新失败', icon: 'none' })
  }
}

/** 开启昵称编辑 */
function startEditNickname() {
  editNickname.value = userStore.profile?.nickname || ''
  editingProfile.value = true
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
      <view class="avatar-btn" @tap="onChooseAvatar">
        <image
          v-if="userStore.profile?.avatarUrl"
          class="avatar"
          :src="userStore.profile.avatarUrl"
          mode="aspectFill"
        />
        <view v-else class="avatar-default">
          <text class="avatar-placeholder">👤</text>
        </view>
        <view class="avatar-edit-hint">换</view>
      </view>
      <view class="info">
        <view v-if="!editingProfile" class="nickname-row" @click="startEditNickname">
          <text class="nickname">{{ userStore.profile?.nickname || '点击设置昵称' }}</text>
          <text class="edit-icon">✎</text>
        </view>
        <input
          v-else
          class="nickname-input"
          type="nickname"
          :value="editNickname"
          placeholder="输入昵称"
          @blur="onNicknameConfirm"
          @confirm="onNicknameConfirm"
        />
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
.avatar-btn {
  position: relative;
  width: 120rpx;
  height: 120rpx;
  padding: 0;
  margin: 0;
  border: none;
  background: transparent;
  line-height: normal;
  flex-shrink: 0;
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
.nickname-row {
  display: flex;
  align-items: center;
  gap: 12rpx;
}
.edit-icon {
  font-size: 24rpx;
  color: #ababab;
}
.nickname-input {
  font-size: 36rpx;
  font-weight: 600;
  border-bottom: 2rpx solid #1a1a1a;
  padding-bottom: 4rpx;
  width: 300rpx;
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
.uid {
  font-size: 24rpx;
  color: #ababab;
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
</style>
