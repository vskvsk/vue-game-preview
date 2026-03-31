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
          <div class="section-header">
            <button class="btn-back" @click="selectedHost = null">
              ← 返回主机列表
            </button>
            <h2>{{ selectedHost.name }} - 游戏库</h2>
          </div>

          <div class="settings-bar">
            <div class="setting-item">
              <label>分辨率:</label>
              <select v-model="streamSettings.videoSize">
                <option value="720p">720p</option>
                <option value="1080p">1080p</option>
                <option value="1440p">1440p</option>
                <option value="4k">4K</option>
              </select>
            </div>
            <div class="setting-item">
              <label>帧率:</label>
              <select v-model="streamSettings.fps">
                <option :value="30">30 FPS</option>
                <option :value="60">60 FPS</option>
                <option :value="120">120 FPS</option>
              </select>
            </div>
            <div class="setting-item">
              <label>码率:</label>
              <select v-model="streamSettings.bitrate">
                <option :value="10000">10 Mbps</option>
                <option :value="20000">20 Mbps</option>
                <option :value="40000">40 Mbps</option>
                <option :value="80000">80 Mbps</option>
              </select>
            </div>
            <div class="setting-item">
              <label>编码:</label>
              <select v-model="streamSettings.videoCodec">
                <option value="h264">H.264</option>
                <option value="h265">H.265 (HEVC)</option>
                <option value="av1">AV1</option>
              </select>
            </div>
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
                  <button class="btn-play">
                    <svg viewBox="0 0 24 24" fill="currentColor">
                      <path d="M8 5v14l11-7z"/>
                    </svg>
                    <span>开始游戏</span>
                  </button>
                </div>
              </div>
              <div class="game-info">
                <h3>{{ app.name }}</h3>
              </div>
            </div>
          </div>
          
          <div class="empty-state" v-if="apps.length === 0">
            <p>该主机暂无游戏</p>
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
import { ref, reactive, onMounted } from 'vue'
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
  
  try {
    const appList = await apiGetApps(host.host_id)
    apps.value = appList
    
    // 加载游戏封面
    appList.forEach(app => {
      if (app.image) {
        loadAppImage(host.host_id, app.app_id)
      }
    })
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

// 获取游戏封面样式
const getAppImageStyle = (app) => {
  const imageUrl = appImages.value.get(app.app_id)
  if (imageUrl) {
    return { backgroundImage: `url(${imageUrl})` }
  }
  return { background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }
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
.section-header {
  margin-bottom: 30px;
}

.btn-back {
  background: none;
  border: none;
  color: #888;
  cursor: pointer;
  font-size: 14px;
  margin-bottom: 15px;
}

.btn-back:hover {
  color: #fff;
}

.settings-bar {
  display: flex;
  gap: 20px;
  margin-bottom: 30px;
  padding: 15px 20px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  flex-wrap: wrap;
}

.setting-item {
  display: flex;
  align-items: center;
  gap: 10px;
}

.setting-item label {
  color: #888;
  font-size: 14px;
}

.setting-item select {
  padding: 6px 12px;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 4px;
  color: #fff;
  font-size: 14px;
  cursor: pointer;
}

.setting-item select:focus {
  outline: none;
  border-color: #667eea;
}

.games-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 20px;
}

.game-card {
  cursor: pointer;
  transition: transform 0.2s;
}

.game-card:hover {
  transform: scale(1.02);
}

.game-image {
  aspect-ratio: 3/4;
  background-size: cover;
  background-position: center;
  border-radius: 12px;
  overflow: hidden;
  position: relative;
}

.game-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.3s;
}

.game-card:hover .game-overlay {
  opacity: 1;
}

.btn-play {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 24px;
  background: linear-gradient(90deg, #667eea, #764ba2);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: transform 0.2s;
}

.btn-play:hover {
  transform: scale(1.05);
}

.btn-play svg {
  width: 20px;
  height: 20px;
}

.game-info {
  padding: 15px 5px;
}

.game-info h3 {
  font-size: 16px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.empty-state {
  text-align: center;
  padding: 60px;
  color: #666;
}
</style>
