<template>
  <div class="simple-start">
    <!-- 配置面板 -->
    <div class="config-panel" v-if="!isStreaming">
      <h1>云游戏启动器</h1>
      
      <div class="config-form">
        <div class="form-row">
          <label>主机 ID:</label>
          <input type="number" v-model.number="config.hostId" placeholder="输入主机 ID" />
        </div>
        
        <div class="form-row">
          <label>游戏 ID:</label>
          <input type="number" v-model.number="config.appId" placeholder="输入游戏 ID" />
        </div>
        
        <div class="form-row">
          <label>分辨率:</label>
          <select v-model="config.videoSize">
            <option value="720p">720p</option>
            <option value="1080p">1080p</option>
            <option value="1440p">1440p</option>
            <option value="4k">4K</option>
          </select>
        </div>
        
        <div class="form-row">
          <label>帧率:</label>
          <select v-model.number="config.fps">
            <option :value="30">30 FPS</option>
            <option :value="60">60 FPS</option>
            <option :value="120">120 FPS</option>
          </select>
        </div>
        
        <div class="form-row">
          <label>码率:</label>
          <select v-model.number="config.bitrate">
            <option :value="10000">10 Mbps</option>
            <option :value="20000">20 Mbps</option>
            <option :value="40000">40 Mbps</option>
          </select>
        </div>
        
        <button 
          class="start-btn" 
          @click="startGame"
          :disabled="!canStart || isLoading"
        >
          {{ isLoading ? '连接中...' : '开始游戏' }}
        </button>
        
        <p class="error-text" v-if="errorMsg">{{ errorMsg }}</p>
      </div>
      
      <div class="tips">
        <h3>使用说明:</h3>
        <ul>
          <li>确保已登录 Moonlight 服务器</li>
          <li>输入正确的主机 ID 和游戏 ID</li>
          <li>点击"开始游戏"启动云游戏</li>
          <li>Ctrl+Shift+F 切换全屏</li>
          <li>点击"锁定鼠标"按钮进入 3D 游戏模式</li>
        </ul>
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
  </div>
</template>

<script setup>
import { ref, reactive, computed } from 'vue'
import GameStream from '@/components/GameStream.vue'

const isStreaming = ref(false)
const isLoading = ref(false)
const errorMsg = ref('')

const config = reactive({
  hostId: 1,
  appId: 1,
  videoSize: '1080p',
  fps: 60,
  bitrate: 20000,
  videoCodec: 'h264'
})

const canStart = computed(() => {
  return config.hostId > 0 && config.appId > 0
})

const streamSettings = computed(() => ({
  videoSize: config.videoSize,
  fps: config.fps,
  bitrate: config.bitrate,
  videoCodec: config.videoCodec
}))

const startGame = () => {
  if (!canStart.value) {
    errorMsg.value = '请输入主机 ID 和游戏 ID'
    return
  }
  
  isLoading.value = true
  errorMsg.value = ''
  
  // 延迟一点显示加载状态
  setTimeout(() => {
    isStreaming.value = true
    isLoading.value = false
  }, 500)
}

const onConnected = () => {
  console.log('游戏流已连接')
}

const onDisconnected = () => {
  console.log('游戏流已断开')
  isStreaming.value = false
}

const onError = (error) => {
  console.error('游戏流错误:', error)
  errorMsg.value = '连接失败: ' + error.message
  isStreaming.value = false
  isLoading.value = false
}

const onReady = () => {
  console.log('游戏流准备就绪，可以开始游戏了！')
}
</script>

<style scoped>
.simple-start {
  min-height: 100vh;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px;
}

.config-panel {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 20px;
  padding: 50px;
  max-width: 500px;
  width: 100%;
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

h1 {
  text-align: center;
  margin-bottom: 40px;
  font-size: 32px;
  background: linear-gradient(90deg, #667eea, #764ba2);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.config-form {
  margin-bottom: 40px;
}

.form-row {
  margin-bottom: 20px;
}

.form-row label {
  display: block;
  margin-bottom: 8px;
  color: #aaa;
  font-size: 14px;
}

.form-row input,
.form-row select {
  width: 100%;
  padding: 12px 16px;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 10px;
  color: #fff;
  font-size: 16px;
  transition: all 0.3s;
}

.form-row input:focus,
.form-row select:focus {
  outline: none;
  border-color: #667eea;
  background: rgba(255, 255, 255, 0.12);
}

.start-btn {
  width: 100%;
  padding: 16px;
  margin-top: 20px;
  background: linear-gradient(90deg, #667eea, #764ba2);
  color: white;
  border: none;
  border-radius: 10px;
  font-size: 18px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s;
}

.start-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 10px 30px rgba(102, 126, 234, 0.4);
}

.start-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.error-text {
  color: #ef4444;
  text-align: center;
  margin-top: 15px;
  font-size: 14px;
}

.tips {
  padding-top: 30px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.tips h3 {
  margin-bottom: 15px;
  color: #888;
  font-size: 14px;
}

.tips ul {
  list-style: none;
  padding: 0;
}

.tips li {
  padding: 8px 0;
  color: #666;
  font-size: 13px;
  padding-left: 20px;
  position: relative;
}

.tips li::before {
  content: '•';
  position: absolute;
  left: 5px;
  color: #667eea;
}
</style>
