<template>
  <div class="launcher" v-if="!isStreaming">
    <!-- ══════════════ 顶部 Hero 轮播 ══════════════ -->
    <div class="hero" v-if="apps.length > 0">
      <div
        class="hero-slides"
        :style="{ transform: `translateX(-${heroIndex * 100}%)` }"
      >
        <div
          v-for="app in heroApps"
          :key="app.app_id"
          class="hero-slide"
          :style="{ backgroundImage: `url(${appImages[app.app_id] || fallbackBanner(app.title)})` }"
        >
          <div class="hero-mask" />
          <div class="hero-info">
            <h2 class="hero-title">{{ app.title }}</h2>
            <span v-if="app.is_hdr_supported" class="badge-hdr">HDR</span>
            <button class="hero-play-btn" @click="selectAndStart(app)">立即游玩</button>
          </div>
        </div>
      </div>

      <!-- 左右箭头 -->
      <button class="hero-arrow left" @click="prevHero">‹</button>
      <button class="hero-arrow right" @click="nextHero">›</button>

      <!-- 指示点 -->
      <div class="hero-dots">
        <span
          v-for="(app, i) in heroApps"
          :key="app.app_id"
          class="hero-dot"
          :class="{ active: i === heroIndex }"
          @click="heroIndex = i"
        />
      </div>
    </div>

    <!-- Hero 骨架屏 -->
    <div class="hero hero-skeleton" v-else-if="appsLoading">
      <div class="skeleton-shimmer" />
    </div>

    <!-- ══════════════ 主体内容 ══════════════ -->
    <div class="main-content">
      <!-- 顶部栏：主机配置 -->
      <div class="top-bar">
        <div class="host-input-wrap">
          <span class="host-label">主机 ID</span>
          <input
            class="host-input"
            type="number"
            v-model.number="config.hostId"
            placeholder="输入主机 ID"
            @keyup.enter="loadApps"
          />
          <button class="btn-load" @click="loadApps" :disabled="!config.hostId || appsLoading">
            <span v-if="appsLoading" class="spinner" />
            <span>{{ appsLoading ? '加载中' : '加载游戏库' }}</span>
          </button>
        </div>
        <p class="error-tip" v-if="errorMsg">{{ errorMsg }}</p>
      </div>

      <!-- 游戏库 -->
      <template v-if="apps.length > 0">
        <section class="game-section">
          <div class="section-header">
            <h3 class="section-title">全部游戏</h3>
            <span class="section-count">{{ apps.length }} 款</span>
          </div>
          <div class="game-grid">
            <div
              v-for="app in apps"
              :key="app.app_id"
              class="game-card"
              @click="selectAndStart(app)"
            >
              <div class="card-cover">
                <img
                  :src="appImages[app.app_id] || fallbackCover(app.title)"
                  :alt="app.title"
                  @error="onImgError($event, app.app_id)"
                />
                <div class="card-overlay">
                  <span class="icon-play">▶</span>
                </div>
                <span v-if="app.is_hdr_supported" class="badge-hdr card-hdr">HDR</span>
              </div>
              <div class="card-footer">
                <p class="card-name">{{ app.title }}</p>
              </div>
            </div>
          </div>
        </section>
      </template>

      <!-- 空态 -->
      <div class="empty-wrap" v-else-if="appsLoaded && !appsLoading">
        <div class="empty-icon">🎮</div>
        <p>未找到游戏，请检查主机 ID</p>
      </div>

      <!-- 初始引导 -->
      <div class="empty-wrap guide" v-else-if="!appsLoading">
        <div class="empty-icon">🕹️</div>
        <p>输入主机 ID 并点击「加载游戏库」开始</p>
      </div>
    </div>
  </div>

  <!-- 游戏流 -->
  <GameStream
    v-else
    :host-id="config.hostId"
    :app-id="config.appId"
    :settings="streamSettings"
    @connected="onConnected"
    @disconnected="onDisconnected"
    @error="onError"
    @ready="onReady"
  />
</template>

<script setup>
import { ref, reactive, computed, onMounted, onUnmounted } from 'vue'
import GameStream from '@/components/GameStream.vue'
import { apiGetApps, apiGetAppImage } from '@/services/api.js'

const isStreaming = ref(false)
const isLoading = ref(false)
const errorMsg = ref('')

const apps = ref([])
const appImages = ref({})
const appsLoading = ref(false)
const appsLoaded = ref(false)

const config = reactive({
  hostId: 1168165742,
  appId: 0,
  videoSize: '1080p',
  fps: 60,
  bitrate: 20000,
  videoCodec: 'h264'
})

const streamSettings = computed(() => ({
  videoSize: config.videoSize,
  fps: config.fps,
  bitrate: config.bitrate,
  videoCodec: config.videoCodec
}))

// Hero 轮播（取前 5 款）
const heroApps = computed(() => apps.value.slice(0, 5))
const heroIndex = ref(0)
let heroTimer = null

function nextHero() {
  heroIndex.value = (heroIndex.value + 1) % heroApps.value.length
}
function prevHero() {
  heroIndex.value = (heroIndex.value - 1 + heroApps.value.length) % heroApps.value.length
}
function startAutoPlay() {
  heroTimer = setInterval(nextHero, 4000)
}
function stopAutoPlay() {
  clearInterval(heroTimer)
}

onMounted(() => startAutoPlay())
onUnmounted(() => stopAutoPlay())

// ────────── 占位图 ──────────
const PALETTE = [
  ['#1a1a2e', '#16213e', '#0f3460'],
  ['#2d1b69', '#11998e', '#38ef7d'],
  ['#0f2027', '#203a43', '#2c5364'],
  ['#360033', '#0b8793', '#36d1dc'],
  ['#1f4037', '#99f2c8', '#56ab2f'],
  ['#373b44', '#4286f4', '#373b44'],
  ['#1a1a1a', '#c0392b', '#e74c3c'],
  ['#141e30', '#243b55', '#6a85b6'],
]

function gradientFromTitle(title, w, h) {
  const idx = Math.abs(title.split('').reduce((a, c) => a + c.charCodeAt(0), 0)) % PALETTE.length
  const [c1, c2, c3] = PALETTE[idx]
  const letter = title.charAt(0).toUpperCase()
  const fs = Math.floor(Math.min(w, h) * 0.38)
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
    <defs>
      <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${c1}"/>
        <stop offset="50%" stop-color="${c2}"/>
        <stop offset="100%" stop-color="${c3}"/>
      </linearGradient>
    </defs>
    <rect width="${w}" height="${h}" fill="url(#g)"/>
    <text x="${w / 2}" y="${h / 2}" font-family="Arial Black,Arial" font-weight="900"
      font-size="${fs}" fill="rgba(255,255,255,0.15)"
      text-anchor="middle" dominant-baseline="middle">${letter}</text>
    <text x="${w / 2}" y="${h * 0.72}" font-family="Arial" font-size="${Math.floor(w * 0.075)}"
      fill="rgba(255,255,255,0.55)" text-anchor="middle">${title}</text>
  </svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

function fallbackCover(title) { return gradientFromTitle(title, 220, 300) }
function fallbackBanner(title) { return gradientFromTitle(title, 1200, 500) }

function onImgError(event, appId) {
  const app = apps.value.find(a => a.app_id === appId)
  if (app) event.target.src = fallbackCover(app.title)
}

// ────────── 数据加载 ──────────
async function loadApps() {
  if (!config.hostId || appsLoading.value) return
  appsLoading.value = true
  appsLoaded.value = false
  errorMsg.value = ''
  apps.value = []
  appImages.value = {}
  heroIndex.value = 0

  try {
    const list = await apiGetApps(config.hostId)
    apps.value = list || []
    appsLoaded.value = true
    for (const app of apps.value) loadAppImage(app)
  } catch (e) {
    errorMsg.value = '加载游戏库失败: ' + e.message
  } finally {
    appsLoading.value = false
  }
}

async function loadAppImage(app) {
  try {
    const blob = await apiGetAppImage({ host_id: config.hostId, app_id: app.app_id })
    const url = URL.createObjectURL(blob)
    appImages.value = { ...appImages.value, [app.app_id]: url }
  } catch { /* 保持 fallback */ }
}

function selectAndStart(app) {
  if (isLoading.value) return
  config.appId = app.app_id
  isLoading.value = true
  errorMsg.value = ''
  setTimeout(() => { isStreaming.value = true; isLoading.value = false }, 300)
}

const onConnected = () => console.log('游戏流已连接')
const onDisconnected = () => { isStreaming.value = false }
const onError = (error) => {
  errorMsg.value = '连接失败: ' + (error.message || '')
  isStreaming.value = false
  isLoading.value = false
}
const onReady = () => console.log('游戏流准备就绪')
</script>

<style scoped>
* { box-sizing: border-box; }

.launcher {
  min-height: 100vh;
  background: #111318;
  color: #e0e0e0;
  font-family: 'PingFang SC', 'Microsoft YaHei', sans-serif;
}

/* ══════════ Hero 轮播 ══════════ */
.hero {
  position: relative;
  width: 100%;
  height: 460px;
  overflow: hidden;
  background: #1a1a2e;
}

.hero-skeleton {
  height: 460px;
}

.skeleton-shimmer {
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, #1e1e2e 25%, #2a2a3e 50%, #1e1e2e 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
}

@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

.hero-slides {
  display: flex;
  width: 100%;
  height: 100%;
  transition: transform 0.55s cubic-bezier(0.4, 0, 0.2, 1);
}

.hero-slide {
  flex-shrink: 0;
  width: 100%;
  height: 100%;
  background-size: cover;
  background-position: center;
  position: relative;
}

.hero-mask {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    to right,
    rgba(0, 0, 0, 0.75) 0%,
    rgba(0, 0, 0, 0.3) 50%,
    transparent 100%
  );
}

.hero-info {
  position: absolute;
  bottom: 80px;
  left: 80px;
  z-index: 1;
}

.hero-title {
  font-size: 36px;
  font-weight: 800;
  color: #fff;
  text-shadow: 0 2px 12px rgba(0,0,0,0.6);
  margin: 0 0 12px;
  max-width: 420px;
}

.badge-hdr {
  display: inline-block;
  background: linear-gradient(135deg, #f093fb, #f5576c);
  color: #fff;
  font-size: 11px;
  font-weight: 700;
  padding: 2px 7px;
  border-radius: 4px;
  margin-bottom: 16px;
  letter-spacing: 1px;
}

.hero-play-btn {
  display: block;
  margin-top: 16px;
  padding: 12px 36px;
  background: linear-gradient(90deg, #667eea, #764ba2);
  color: #fff;
  border: none;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 700;
  cursor: pointer;
  transition: opacity 0.2s, transform 0.2s;
}

.hero-play-btn:hover {
  opacity: 0.9;
  transform: translateY(-2px);
}

.hero-arrow {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  background: rgba(0, 0, 0, 0.4);
  border: 1px solid rgba(255,255,255,0.15);
  color: #fff;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  font-size: 26px;
  line-height: 1;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2;
  transition: background 0.2s;
}

.hero-arrow:hover { background: rgba(102, 126, 234, 0.6); }
.hero-arrow.left { left: 24px; }
.hero-arrow.right { right: 24px; }

.hero-dots {
  position: absolute;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 8px;
  z-index: 2;
}

.hero-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: rgba(255,255,255,0.35);
  cursor: pointer;
  transition: all 0.3s;
}

.hero-dot.active {
  background: #fff;
  width: 24px;
  border-radius: 4px;
}

/* ══════════ 主体 ══════════ */
.main-content {
  max-width: 1280px;
  margin: 0 auto;
  padding: 32px 40px 60px;
}

/* 顶部配置栏 */
.top-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 36px;
  flex-wrap: wrap;
}

.host-input-wrap {
  display: flex;
  align-items: center;
  gap: 10px;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 10px;
  padding: 8px 14px;
}

.host-label {
  color: #888;
  font-size: 13px;
  white-space: nowrap;
}

.host-input {
  background: transparent;
  border: none;
  outline: none;
  color: #fff;
  font-size: 14px;
  width: 160px;
}

.host-input::placeholder { color: #555; }

.btn-load {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 18px;
  background: linear-gradient(90deg, #667eea, #764ba2);
  color: #fff;
  border: none;
  border-radius: 7px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.2s;
  white-space: nowrap;
}

.btn-load:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-load:not(:disabled):hover { opacity: 0.88; }

.spinner {
  width: 12px;
  height: 12px;
  border: 2px solid rgba(255,255,255,0.4);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
  flex-shrink: 0;
}

@keyframes spin { to { transform: rotate(360deg); } }

.error-tip {
  color: #f87171;
  font-size: 13px;
  margin: 0;
}

/* 区块标题 */
.game-section { margin-bottom: 48px; }

.section-header {
  display: flex;
  align-items: baseline;
  gap: 10px;
  margin-bottom: 20px;
  padding-bottom: 12px;
  border-bottom: 2px solid rgba(255,255,255,0.06);
}

.section-title {
  font-size: 20px;
  font-weight: 700;
  color: #fff;
  margin: 0;
  position: relative;
  padding-left: 14px;
}

.section-title::before {
  content: '';
  position: absolute;
  left: 0;
  top: 2px;
  bottom: 2px;
  width: 4px;
  background: linear-gradient(180deg, #667eea, #764ba2);
  border-radius: 2px;
}

.section-count {
  font-size: 13px;
  color: #666;
}

/* 游戏卡片网格 */
.game-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 20px;
}

.game-card {
  cursor: pointer;
  border-radius: 10px;
  overflow: hidden;
  background: #1c1e27;
  border: 2px solid transparent;
  transition: transform 0.22s, border-color 0.22s, box-shadow 0.22s;
}

.game-card:hover {
  transform: translateY(-5px);
  border-color: rgba(102, 126, 234, 0.55);
  box-shadow: 0 12px 32px rgba(0,0,0,0.5);
}

.card-cover {
  position: relative;
  aspect-ratio: 3 / 4;
  overflow: hidden;
  background: #12131a;
}

.card-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  transition: transform 0.3s;
}

.game-card:hover .card-cover img { transform: scale(1.06); }

.card-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0,0,0,0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.22s;
}

.game-card:hover .card-overlay { opacity: 1; }

.icon-play {
  font-size: 40px;
  color: #fff;
  text-shadow: 0 0 16px rgba(102, 126, 234, 1);
}

.card-hdr {
  position: absolute;
  top: 8px;
  right: 8px;
  margin: 0;
}

.card-footer {
  padding: 10px 12px 12px;
}

.card-name {
  margin: 0;
  font-size: 13px;
  color: #ccc;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 空态 */
.empty-wrap {
  text-align: center;
  padding: 80px 0;
  color: #555;
}

.empty-icon {
  font-size: 56px;
  margin-bottom: 16px;
}

.empty-wrap p { font-size: 15px; margin: 0; }
.guide { color: #444; }
</style>
