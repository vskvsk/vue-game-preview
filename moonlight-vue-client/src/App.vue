<template>
  <div class="app">
    <!-- 登录界面 -->
    <div class="login-screen" v-if="!isLoggedIn">
      <div class="login-box">
        <h1>云游戏平台</h1>
        <p class="subtitle">基于 Moonlight Web 技术</p>
        
        <div class="form-group">
          <input 
            type="text" 
            v-model="loginForm.username" 
            placeholder="用户名"
            @keyup.enter="handleLogin"
          />
        </div>
        
        <div class="form-group">
          <input 
            type="password" 
            v-model="loginForm.password" 
            placeholder="密码"
            @keyup.enter="handleLogin"
          />
        </div>
        
        <button class="btn-primary" @click="handleLogin" :disabled="isLoading">
          {{ isLoading ? '登录中...' : '登录' }}
        </button>
        
        <p class="error-msg" v-if="loginError">{{ loginError }}</p>
        
        <div class="guest-login">
          <button class="btn-text" @click="guestLogin">
            游客访问
          </button>
        </div>
      </div>
    </div>

    <!-- 游戏列表界面 -->
    <div class="game-list-screen" v-else-if="isLoggedIn && !isStreaming">
      <header class="app-header">
        <h1>云游戏平台</h1>
        <div class="header-actions">
          <span class="user-info">欢迎, {{ currentUser?.name || '用户' }}</span>
          <button class="btn-secondary" @click="logout">退出登录</button>
        </div>
      </header>

      <main class="main-content">
        <!-- 主机列表 -->
        <section class="hosts-section" v-if="!selectedHost">
          <h2>选择游戏主机</h2>
          <div class="hosts-grid">
            <div 
              v-for="host in hosts" 
              :key="host.host_id"
              class="host-card"
              @click="selectHost(host)"
            >
              <div class="host-icon">
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20 3H4c-1.1 0-2 .9-2 2v11c0 1.1.9 2 2 2h3l-1 1v2h12v-2l-1-1h3c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 13H4V5h16v11z"/>
                </svg>
              </div>
              <div class="host-info">
                <h3>{{ host.name }}</h3>
                <p class="host-address">{{ host.address }}</p>
                <span class="host-status" :class="(host.server_state || 'offline').toLowerCase()">
                  {{ host.server_state === 'Online' ? '在线' : (host.server_state === 'Busy' ? '忙碌' : '离线') }}
                </span>
              </div>
            </div>
          </div>
          
          <div class="empty-state" v-if="hosts.length === 0">
            <p>暂无可用主机</p>
          </div>
        </section>

        <!-- 游戏列表 -->
        <section class="games-section" v-else>
          <!-- 顶部操作栏 -->
          <div class="games-topbar">
            <button class="btn-back" @click="selectedHost = null">← 返回主机列表</button>
            <h2>{{ selectedHost.name }}</h2>
          </div>

          <!-- Hero 轮播 -->
          <div class="hero" v-if="heroApps.length > 0">
            <div class="hero-slides" :style="{ transform: `translateX(-${heroIndex * 100}%)` }">
              <div
                v-for="app in heroApps"
                :key="app.app_id"
                class="hero-slide"
                :style="{ backgroundImage: `url(${appImages.get(app.app_id) || fallbackBanner(app.title)})` }"
              >
                <div class="hero-mask" />
                <div class="hero-info">
                  <h2 class="hero-title">{{ app.title }}</h2>
                  <span v-if="app.is_hdr_supported" class="badge-hdr">HDR</span>
                  <button class="hero-play-btn" @click="startGame(app)">立即游玩</button>
                </div>
              </div>
            </div>
            <button class="hero-arrow left" @click="prevHero">‹</button>
            <button class="hero-arrow right" @click="nextHero">›</button>
            <div class="hero-dots">
              <span
                v-for="(app, i) in heroApps" :key="app.app_id"
                class="hero-dot" :class="{ active: i === heroIndex }"
                @click="heroIndex = i"
              />
            </div>
          </div>

          <!-- 游戏网格 -->
          <div class="games-grid-wrap">
            <div class="games-grid-header">
              <span class="grid-title">全部游戏</span>
              <span class="grid-count">{{ apps.length }} 款</span>
            </div>
            <div class="games-grid">
              <div
                v-for="app in apps"
                :key="app.app_id"
                class="game-card"
                @click="startGame(app)"
              >
                <div class="game-image" :style="getAppImageStyle(app)">
                  <div class="game-overlay">
                    <span class="icon-play">▶</span>
                  </div>
                  <span v-if="app.is_hdr_supported" class="badge-hdr card-hdr">HDR</span>
                </div>
                <div class="game-info">
                  <h3>{{ app.title }}</h3>
                </div>
              </div>
            </div>
            <div class="empty-state" v-if="apps.length === 0">
              <p>该主机暂无游戏</p>
            </div>
          </div>
        </section>
      </main>
    </div>

    <!-- 游戏流界面 -->
    <GameStream
      v-else
      :host-id="selectedHost.host_id"
      :app-id="selectedApp.app_id"
      :settings="streamSettings"
      @connected="onStreamConnected"
      @disconnected="onStreamDisconnected"
      @error="onStreamError"
      @ready="onStreamReady"
    />
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onUnmounted } from 'vue'
import GameStream from '@/components/GameStream.vue'
import { apiLogin, apiAuthenticate, apiGetUser, apiGetHosts, apiGetApps, apiGetAppImage } from '@/services/api.js'
import { MOONLIGHT_CONFIG } from '@/config/moonlight.js'

// 状态
const isLoggedIn = ref(false)
const isLoading = ref(false)
const loginError = ref('')
const currentUser = ref(null)
const hosts = ref([])
const apps = ref([])
const selectedHost = ref(null)
const selectedApp = ref(null)
const isStreaming = ref(false)
const appImages = ref(new Map())

// 表单
const loginForm = reactive({
  username: 'admin',
  password: 'admin'
})

// 流设置
const streamSettings = reactive({ ...MOONLIGHT_CONFIG.defaultSettings })

// 检查登录状态
const checkAuth = async () => {
  try {
    const isAuth = await apiAuthenticate()
    if (isAuth) {
      currentUser.value = await apiGetUser()
      isLoggedIn.value = true
      loadHosts()
    }
  } catch (e) {
    console.log('未登录')
  }
}

// 登录
const handleLogin = async () => {
  if (!loginForm.username || !loginForm.password) {
    loginError.value = '请输入用户名和密码'
    return
  }
  
  isLoading.value = true
  loginError.value = ''
  
  try {
    const success = await apiLogin(loginForm.username, loginForm.password)
    if (success) {
      currentUser.value = await apiGetUser()
      isLoggedIn.value = true
      loadHosts()
    } else {
      loginError.value = '用户名或密码错误'
    }
  } catch (e) {
    loginError.value = '登录失败: ' + e.message
  } finally {
    isLoading.value = false
  }
}

// 游客登录
const guestLogin = async () => {
  // 某些 Moonlight 服务器允许默认用户访问
  try {
    const isAuth = await apiAuthenticate()
    if (isAuth) {
      currentUser.value = await apiGetUser()
      isLoggedIn.value = true
      loadHosts()
    }
  } catch (e) {
    loginError.value = '游客访问失败，请使用账号登录'
  }
}


// 退出登录
const logout = () => {
  isLoggedIn.value = false
  currentUser.value = null
  hosts.value = []
  apps.value = []
  selectedHost.value = null
  // 清除 cookie/session
  fetch('/api/logout', { method: 'POST', credentials: 'include' }).catch(() => {})
}


// 加载主机列表
const loadHosts = async () => {
  try {
    const stream = await apiGetHosts()
    // 第一包：{ hosts: [...] } 初始列表
    const first = await stream.next()
    if (first && first.hosts) {
      hosts.value = first.hosts
    }
    // 后续包：单个主机状态更新 { host_id, server_state, ... }
    let item
    while ((item = await stream.next()) !== null) {
      if (item.host_id !== undefined) {
        const idx = hosts.value.findIndex(h => h.host_id === item.host_id)
        if (idx !== -1) {
          hosts.value[idx] = { ...hosts.value[idx], ...item }
        }
      }
    }
  } catch (e) {
    console.error('加载主机列表失败:', e)
  }
}

// 选择主机
const selectHost = async (host) => {
  selectedHost.value = host
  heroIndex.value = 0
  
  try {
    const appList = await apiGetApps(host.host_id)
    apps.value = appList
    // 全量异步加载封面
    appList.forEach(app => loadAppImage(host.host_id, app.app_id))
  } catch (e) {
    console.error('加载游戏列表失败:', e)
    apps.value = []
  }
}

// 加载游戏封面
const loadAppImage = async (hostId, appId) => {
  try {
    const blob = await apiGetAppImage({ host_id: hostId, app_id: appId })
    const url = URL.createObjectURL(blob)
    appImages.value.set(appId, url)
  } catch (e) {
    console.error('加载游戏封面失败:', e)
  }
}

// Hero 轮播
const heroApps = computed(() => apps.value.slice(0, 5))
const heroIndex = ref(0)
let heroTimer = null

function nextHero() {
  if (heroApps.value.length === 0) return
  heroIndex.value = (heroIndex.value + 1) % heroApps.value.length
}
function prevHero() {
  if (heroApps.value.length === 0) return
  heroIndex.value = (heroIndex.value - 1 + heroApps.value.length) % heroApps.value.length
}

// 封面 fallback
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

function gradientSvg(title, w, h) {
  const idx = Math.abs(title.split('').reduce((a, c) => a + c.charCodeAt(0), 0)) % PALETTE.length
  const [c1, c2, c3] = PALETTE[idx]
  const letter = title.charAt(0).toUpperCase()
  const fs = Math.floor(Math.min(w, h) * 0.38)
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
    <defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${c1}"/>
      <stop offset="50%" stop-color="${c2}"/>
      <stop offset="100%" stop-color="${c3}"/>
    </linearGradient></defs>
    <rect width="${w}" height="${h}" fill="url(#g)"/>
    <text x="${w/2}" y="${h/2}" font-family="Arial Black,Arial" font-weight="900"
      font-size="${fs}" fill="rgba(255,255,255,0.12)"
      text-anchor="middle" dominant-baseline="middle">${letter}</text>
    <text x="${w/2}" y="${h*0.76}" font-family="Arial" font-size="${Math.floor(w*0.07)}"
      fill="rgba(255,255,255,0.5)" text-anchor="middle">${title}</text>
  </svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

function fallbackBanner(title) { return gradientSvg(title, 1200, 460) }

// 获取游戏封面样式（带 fallback）
const getAppImageStyle = (app) => {
  const url = appImages.value.get(app.app_id)
  return { backgroundImage: `url(${url || gradientSvg(app.title, 220, 295)})` }
}



// 开始游戏
const startGame = (app) => {
  selectedApp.value = app
  isStreaming.value = true
}

// 流事件处理
const onStreamConnected = () => {
  console.log('游戏流已连接')
}

const onStreamDisconnected = () => {
  isStreaming.value = false
  selectedApp.value = null
}

const onStreamError = (error) => {
  console.error('游戏流错误:', error)
  alert('游戏连接失败: ' + error.message)
  isStreaming.value = false
}

const onStreamReady = () => {
  console.log('游戏流准备就绪')
}

onMounted(() => {
  checkAuth()
  heroTimer = setInterval(nextHero, 4000)
})

onUnmounted(() => {
  clearInterval(heroTimer)
})
</script>

<style scoped>
.app {
  min-height: 100vh;
  background: #0f0f23;
}

/* 登录界面 */
.login-screen {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
}

.login-box {
  width: 100%;
  max-width: 400px;
  padding: 40px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 16px;
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.login-box h1 {
  text-align: center;
  margin-bottom: 8px;
  font-size: 28px;
  background: linear-gradient(90deg, #667eea, #764ba2);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.subtitle {
  text-align: center;
  color: #888;
  margin-bottom: 30px;
}

.form-group {
  margin-bottom: 20px;
}

.form-group input {
  width: 100%;
  padding: 12px 16px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  color: #fff;
  font-size: 16px;
  transition: border-color 0.3s;
}

.form-group input:focus {
  outline: none;
  border-color: #667eea;
}

.form-group input::placeholder {
  color: #666;
}

.btn-primary {
  width: 100%;
  padding: 14px;
  background: linear-gradient(90deg, #667eea, #764ba2);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.3s;
}

.btn-primary:hover:not(:disabled) {
  opacity: 0.9;
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.error-msg {
  color: #ef4444;
  text-align: center;
  margin-top: 15px;
  font-size: 14px;
}

.guest-login {
  text-align: center;
  margin-top: 20px;
}

.btn-text {
  background: none;
  border: none;
  color: #888;
  cursor: pointer;
  font-size: 14px;
  text-decoration: underline;
}

.btn-text:hover {
  color: #aaa;
}

/* 主界面 */
.app-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 40px;
  background: rgba(0, 0, 0, 0.3);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.app-header h1 {
  font-size: 24px;
  background: linear-gradient(90deg, #667eea, #764ba2);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 20px;
}

.user-info {
  color: #888;
}

.btn-secondary {
  padding: 8px 16px;
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.3s;
}

.btn-secondary:hover {
  background: rgba(255, 255, 255, 0.2);
}

.main-content {
  padding: 40px;
  max-width: 1400px;
  margin: 0 auto;
}

/* 主机列表 */
.hosts-section h2,
.games-section h2 {
  margin-bottom: 30px;
  font-size: 24px;
}

.hosts-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 20px;
}

.host-card {
  display: flex;
  align-items: center;
  gap: 15px;
  padding: 20px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 12px;
  cursor: pointer;
  transition: transform 0.2s, background 0.2s;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.host-card:hover {
  transform: translateY(-2px);
  background: rgba(255, 255, 255, 0.08);
}

.host-icon {
  width: 50px;
  height: 50px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea, #764ba2);
  border-radius: 10px;
}

.host-icon svg {
  width: 28px;
  height: 28px;
  fill: white;
}

.host-info h3 {
  margin-bottom: 4px;
  font-size: 18px;
}

.host-address {
  color: #888;
  font-size: 14px;
  margin-bottom: 8px;
}

.host-status {
  display: inline-block;
  padding: 4px 10px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
}

.host-status.online {
  background: #10b981;
  color: white;
}

.host-status.offline {
  background: #ef4444;
  color: white;
}

/* 游戏列表 */
.btn-back {
  background: none;
  border: none;
  color: #888;
  cursor: pointer;
  font-size: 14px;
  flex-shrink: 0;
}
.btn-back:hover { color: #fff; }

.games-topbar {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 0;
  padding: 0 0 20px;
}

.games-topbar h2 {
  font-size: 20px;
  margin: 0;
  color: #ddd;
}

/* Hero 轮播 */
.hero {
  position: relative;
  width: 100%;
  height: 420px;
  overflow: hidden;
  border-radius: 16px;
  margin-bottom: 36px;
  background: #1a1a2e;
}

.hero-slides {
  display: flex;
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
  background: linear-gradient(to right, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.25) 55%, transparent 100%);
}

.hero-info {
  position: absolute;
  bottom: 60px;
  left: 60px;
  z-index: 1;
}

.hero-title {
  font-size: 32px;
  font-weight: 800;
  color: #fff;
  text-shadow: 0 2px 10px rgba(0,0,0,0.5);
  margin: 0 0 10px;
  max-width: 400px;
}

.badge-hdr {
  display: inline-block;
  background: linear-gradient(135deg, #f093fb, #f5576c);
  color: #fff;
  font-size: 10px;
  font-weight: 700;
  padding: 2px 7px;
  border-radius: 4px;
  letter-spacing: 1px;
  margin-bottom: 14px;
}

.hero-play-btn {
  display: block;
  margin-top: 14px;
  padding: 11px 32px;
  background: linear-gradient(90deg, #667eea, #764ba2);
  color: #fff;
  border: none;
  border-radius: 8px;
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
  transition: opacity 0.2s, transform 0.2s;
}

.hero-play-btn:hover { opacity: 0.9; transform: translateY(-2px); }

.hero-arrow {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  background: rgba(0,0,0,0.4);
  border: 1px solid rgba(255,255,255,0.15);
  color: #fff;
  width: 42px;
  height: 42px;
  border-radius: 50%;
  font-size: 24px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2;
  transition: background 0.2s;
}

.hero-arrow:hover { background: rgba(102,126,234,0.6); }
.hero-arrow.left { left: 20px; }
.hero-arrow.right { right: 20px; }

.hero-dots {
  position: absolute;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 7px;
  z-index: 2;
}

.hero-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: rgba(255,255,255,0.35);
  cursor: pointer;
  transition: all 0.3s;
}

.hero-dot.active {
  background: #fff;
  width: 22px;
  border-radius: 4px;
}

/* 游戏网格 */


.games-grid-header {
  display: flex;
  align-items: baseline;
  gap: 10px;
  margin-bottom: 18px;
  padding-bottom: 12px;
  border-bottom: 2px solid rgba(255,255,255,0.06);
}

.grid-title {
  font-size: 18px;
  font-weight: 700;
  color: #fff;
  padding-left: 12px;
  position: relative;
}

.grid-title::before {
  content: '';
  position: absolute;
  left: 0; top: 2px; bottom: 2px;
  width: 4px;
  background: linear-gradient(180deg, #667eea, #764ba2);
  border-radius: 2px;
}

.grid-count {
  font-size: 13px;
  color: #666;
}

.games-grid {
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
  border-color: rgba(102,126,234,0.55);
  box-shadow: 0 12px 32px rgba(0,0,0,0.5);
}

.game-image {
  aspect-ratio: 3 / 4;
  background-size: cover;
  background-position: center;
  position: relative;
  overflow: hidden;
}

.game-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0,0,0,0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.22s;
}

.game-card:hover .game-overlay { opacity: 1; }

.icon-play {
  font-size: 38px;
  color: #fff;
  text-shadow: 0 0 16px rgba(102,126,234,1);
}

.card-hdr {
  position: absolute;
  top: 8px;
  right: 8px;
  margin: 0;
}

.game-info {
  padding: 10px 12px 12px;
}

.game-info h3 {
  font-size: 13px;
  font-weight: 600;
  color: #ccc;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin: 0;
}

.section-header {
  margin-bottom: 30px;
}

.empty-state {
  text-align: center;
  padding: 60px;
  color: #666;
}
</style>
