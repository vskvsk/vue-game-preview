// 云游戏流服务 - 封装 Moonlight Web 核心功能
import { MOONLIGHT_CONFIG } from '@/config/moonlight.js'

// 加载 Moonlight Web 模块（从原始项目中引用）
// 注意：这些路径需要根据实际项目结构调整
const moonlightBasePath = '/../moonlight-web-stream-file'

export class StreamService {
  constructor() {
    this.stream = null
    this.api = null
    this.eventTarget = new EventTarget()
    this.isInitialized = false
  }

  // 初始化事件监听
  on(event, callback) {
    this.eventTarget.addEventListener(event, callback)
  }

  off(event, callback) {
    this.eventTarget.removeEventListener(event, callback)
  }

  emit(event, data) {
    this.eventTarget.dispatchEvent(new CustomEvent(event, { detail: data }))
  }

  // 初始化 API
  async initApi() {
    const host_url = `${window.location.origin}/api`
    this.api = { host_url, bearer: null, user: null }
    return this.api
  }

  // 动态导入 Moonlight 模块
  async loadMoonlightModules() {
    try {
      // 导入 polyfill
      await import(/* @vite-ignore */ `${moonlightBasePath}/polyfill/index.js`)
      
      // 导入核心 Stream 类
      const { Stream } = await import(/* @vite-ignore */ `${moonlightBasePath}/stream/index.js`)
      const { defaultStreamInputConfig, StreamInput } = await import(/* @vite-ignore */ `${moonlightBasePath}/stream/input.js`)
      const { Logger } = await import(/* @vite-ignore */ `${moonlightBasePath}/stream/log.js`)
      
      return { Stream, defaultStreamInputConfig, StreamInput, Logger }
    } catch (error) {
      console.error('加载 Moonlight 模块失败:', error)
      throw new Error('无法加载云游戏核心模块，请检查 moonlight-web-stream-file 路径')
    }
  }

  // 启动游戏流
  async startStream(hostId, appId, containerElement, settings = {}) {
    if (!this.api) {
      await this.initApi()
    }

    try {
      const modules = await this.loadMoonlightModules()
      
      // 合并设置
      const streamSettings = { ...MOONLIGHT_CONFIG.defaultSettings, ...settings }
      const screenSize = [window.innerWidth, window.innerHeight]

      // 创建流实例
      this.stream = new modules.Stream(this.api, hostId, appId, streamSettings, screenSize)
      
      // 设置事件监听
      this.setupStreamListeners()
      
      // 挂载到容器
      this.stream.mount(containerElement)
      
      this.isInitialized = true
      this.emit('connected', { hostId, appId })
      
      return this.stream
    } catch (error) {
      this.emit('error', { message: error.message, error })
      throw error
    }
  }

  // 设置流事件监听
  setupStreamListeners() {
    if (!this.stream) return

    this.stream.addInfoListener((event) => {
      const data = event.detail
      
      switch (data.type) {
        case 'connectionComplete':
          this.emit('ready', { capabilities: data.capabilities })
          break
        case 'app':
          this.emit('appInfo', data.app)
          break
        case 'addDebugLine':
          this.emit('debug', { message: data.line, type: data.additional?.type })
          if (data.additional?.type === 'fatal') {
            this.emit('error', { message: data.line })
          }
          break
        case 'serverMessage':
          this.emit('serverMessage', data.message)
          break
      }
    })
  }

  // 获取输入控制器
  getInput() {
    return this.stream?.getInput()
  }

  // 获取视频渲染器
  getVideoRenderer() {
    return this.stream?.getVideoRenderer()
  }

  // 获取音频播放器
  getAudioPlayer() {
    return this.stream?.getAudioPlayer()
  }

  // 获取统计信息
  getStats() {
    return this.stream?.getStats()
  }

  // 发送按键
  sendKey(pressed, keyCode, modifiers) {
    this.getInput()?.sendKey(pressed, keyCode, modifiers)
  }

  // 发送文本
  sendText(text) {
    this.getInput()?.sendText(text)
  }

  // 设置输入配置
  setInputConfig(config) {
    this.getInput()?.setConfig({ ...MOONLIGHT_CONFIG.inputConfig, ...config })
  }

  // 停止流
  stop() {
    if (this.stream) {
      // 清理事件监听
      this.stream.eventTarget?.removeAllListeners?.()
      
      // 关闭 WebSocket
      if (this.stream.ws) {
        this.stream.ws.close()
      }
      
      // 清理视频/音频
      this.stream.videoRenderer?.destroy?.()
      this.stream.audioPlayer?.destroy?.()
      
      this.stream = null
      this.isInitialized = false
      this.emit('disconnected')
    }
  }

  // 请求全屏
  async requestFullscreen() {
    const body = document.body
    if (body?.requestFullscreen) {
      await body.requestFullscreen({ navigationUI: 'hide' })
      
      // 锁定键盘（游戏模式）
      if (navigator.keyboard?.lock) {
        await navigator.keyboard.lock()
      }
      
      // 锁定屏幕方向
      if (screen.orientation?.lock) {
        await screen.orientation.lock('landscape').catch(() => {})
      }
    }
  }

  // 退出全屏
  async exitFullscreen() {
    if (navigator.keyboard?.unlock) {
      await navigator.keyboard.unlock()
    }
    if (document.exitFullscreen) {
      await document.exitFullscreen()
    }
  }

  // 请求指针锁定（用于 3D 游戏）
  async requestPointerLock(element) {
    if (element?.requestPointerLock) {
      try {
        await element.requestPointerLock({ unadjustedMovement: true })
        this.setInputConfig({ mouseMode: 'relative' })
      } catch (e) {
        // 降级到普通指针锁定
        element.requestPointerLock()
      }
    }
  }

  // 退出指针锁定
  exitPointerLock() {
    if (document.exitPointerLock) {
      document.exitPointerLock()
    }
  }
}

// 创建单例实例
export const streamService = new StreamService()

// 默认输入处理器 - 用于在 Vue 组件中绑定事件
export function createInputHandlers(streamService) {
  return {
    // 键盘事件
    onKeyDown: (event) => {
      event.preventDefault()
      streamService.getInput()?.onKeyDown(event)
    },
    
    onKeyUp: (event) => {
      event.preventDefault()
      streamService.getInput()?.onKeyUp(event)
    },

    // 鼠标事件
    onMouseDown: (event, rect) => {
      event.preventDefault()
      streamService.getInput()?.onMouseDown(event, rect)
    },
    
    onMouseUp: (event) => {
      event.preventDefault()
      streamService.getInput()?.onMouseUp(event)
    },
    
    onMouseMove: (event, rect) => {
      event.preventDefault()
      streamService.getInput()?.onMouseMove(event, rect)
    },
    
    onMouseWheel: (event) => {
      event.preventDefault()
      streamService.getInput()?.onMouseWheel(event)
    },
    
    onContextMenu: (event) => {
      event.preventDefault()
    },

    // 触摸事件
    onTouchStart: (event, rect) => {
      event.preventDefault()
      streamService.getInput()?.onTouchStart(event, rect)
    },
    
    onTouchEnd: (event, rect) => {
      event.preventDefault()
      streamService.getInput()?.onTouchEnd(event, rect)
    },
    
    onTouchMove: (event, rect) => {
      event.preventDefault()
      streamService.getInput()?.onTouchMove(event, rect)
    },
    
    onTouchCancel: (event, rect) => {
      event.preventDefault()
      streamService.getInput()?.onTouchCancel(event, rect)
    },

    // 游戏手柄事件
    onGamepadConnect: (event) => {
      streamService.getInput()?.onGamepadConnect(event.gamepad)
    },
    
    onGamepadDisconnect: (event) => {
      streamService.getInput()?.onGamepadDisconnect(event)
    }
  }
}
