const { app, BrowserWindow, Menu, Tray, nativeImage, screen, shell } = require('electron')
const path = require('path')
const fs = require('fs')
const { execSync } = require('child_process')

const { createEventCenter, readAppSettings, getOrCreateDeviceCode } = require('./eventCenter.cjs')
const agent = require('./agent.cjs')
const modules = require('./modules.cjs')
const sessions = require('./sessions.cjs')
const assistant = require('./assistant.cjs')
const skills = require('./skills.cjs')
const pluginPacks = require('./plugin-packs.cjs')
const mcpConfigs = require('./mcp-configs.cjs')
const mqttBroker = require('./mqttBroker.cjs')

const isDev = !app.isPackaged
const devServerUrl = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5174'

const eventCenter = createEventCenter()

let mainWindow = null
let tray = null
let trayWindow = null

function setupEventCenter() {
  eventCenter.registerModule(agent)
  eventCenter.registerModule(modules)
  eventCenter.registerModule(sessions)
  eventCenter.registerModule(assistant)
  eventCenter.registerModule(skills)
  eventCenter.registerModule(pluginPacks)
  eventCenter.registerModule(mcpConfigs)
  eventCenter.registerModule(mqttBroker)
  eventCenter.setupIPC()

  eventCenter.register('app', {
    showMain: () => {
      showMainWindow()
      return { ok: true }
    },
    quit: () => {
      app.quit()
      return { ok: true }
    },
    // Open a URL in the default browser
    openInBrowser: ({ url }) => {
      const target = typeof url === 'string' ? url.trim() : ''
      if (!target) throw new Error('url is required')
      // Only allow http/https to prevent protocol abuse
      if (!/^https?:\/\//i.test(target)) throw new Error('url must start with http:// or https://')
      shell.openExternal(target)
      return { ok: true }
    },
    // Open a file or directory with the default OS application
    openExternalApp: ({ path: filePath }) => {
      const target = typeof filePath === 'string' ? filePath : ''
      if (!target || !fs.existsSync(target)) throw new Error('path not found: ' + (target || '(empty)'))
      shell.openPath(target)
      return { ok: true }
    },
    // Open an application by name (cross-platform)
    // macOS: searches /Applications for <name>.app, then falls back to `open -a`
    // Windows: tries `start` command
    openExternalAppByName: ({ name }) => {
      const appName = typeof name === 'string' ? name.trim() : ''
      if (!appName) throw new Error('name is required')

      const platform = process.platform

      if (platform === 'darwin') {
        // macOS: try to find .app in /Applications first (exact + fuzzy match)
        const searchName = appName.toLowerCase()
        const appsDir = '/Applications'

        let found = null
        try {
          const entries = fs.readdirSync(appsDir, { withFileTypes: true })
          for (const e of entries) {
            if (!e.name.endsWith('.app')) continue
            const base = e.name.slice(0, -4).toLowerCase()
            // Exact match or contains match
            if (base === searchName) {
              found = path.join(appsDir, e.name)
              break
            }
            if (base.includes(searchName) || searchName.includes(base)) {
              found = path.join(appsDir, e.name)
              // Don't break — keep looking for exact match (prefer exact)
            }
          }
        } catch { /* dir may not be readable */ }

        if (found) {
          shell.openPath(found)
          return { ok: true, path: found }
        }

        // Fallback: `open -a "Name"`
        execSync(`open -a "${appName.replace(/"/g, '\\"')}"`)
        return { ok: true }
      }

      if (platform === 'win32') {
        // Windows: use `start` to launch by name
        // `start "" "微信"` works if the app is in PATH or registered in Start Menu
        execSync(`start "" "${appName.replace(/"/g, '\\"')}"`, { shell: 'cmd.exe', windowsHide: true })
        return { ok: true }
      }

      // Linux: try xdg-open (may not work for app names, but shell.openPath can handle .desktop)
      try {
        shell.openPath(appName)
      } catch {
        throw new Error('openExternalAppByName is not supported on this platform')
      }
      return { ok: true }
    },
    previewFileDialog: ({ filePath, title }) => {
      const targetPath = typeof filePath === 'string' ? filePath : ''
      if (!targetPath || !fs.existsSync(targetPath)) {
        throw new Error('file not found: ' + (targetPath || '(empty)'))
      }
      const winTitle = typeof title === 'string' && title.trim() ? title.trim() : path.basename(targetPath)
      const parentWin = BrowserWindow.getFocusedWindow() || mainWindow

      const win = new BrowserWindow({
        width: 800,
        height: 700,
        title: winTitle,
        parent: parentWin,
        modal: false,
        webPreferences: {
          preload: path.join(__dirname, 'preload.js'),
          contextIsolation: true,
          nodeIntegration: false
        }
      })

      const encoded = encodeURIComponent(targetPath)
      if (isDev) {
        win.loadURL(`${devServerUrl}?preview=1&path=${encoded}`)
      } else {
        win.loadFile(path.join(__dirname, '../dist/index.html'), { search: `preview=1&path=${encoded}` })
      }

      // Developer mode: auto-open DevTools for preview windows too
      if (readAppSettings().devMode) {
        try { win.webContents.openDevTools() } catch {}
      }

      return { ok: true }
    }
  })

  getOrCreateDeviceCode()
}

function createMainWindow() {
  const isMac = process.platform === 'darwin'
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    ...(isMac ? { titleBarStyle: 'hiddenInset' } : {}),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  if (isDev) {
    win.loadURL(devServerUrl)
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  win.on('closed', () => {
    if (mainWindow === win) mainWindow = null
  })

  mainWindow = win

  // Register the main window with eventCenter so child apps can notify it to refresh
  eventCenter.setMainWindow(win)

  // When developer mode is on, open DevTools for the main window too
  if (readAppSettings().devMode) {
    try { win.webContents.openDevTools() } catch {}
  }

  return win
}

function showMainWindow() {
  if (!mainWindow) {
    createMainWindow()
    return
  }
  if (mainWindow.isMinimized()) mainWindow.restore()
  mainWindow.show()
  mainWindow.focus()
}

function ensureTrayWindow() {
  if (trayWindow && !trayWindow.isDestroyed()) return trayWindow

  trayWindow = new BrowserWindow({
    width: 320,
    height: 420,
    show: false,
    frame: false,
    resizable: false,
    transparent: false,
    alwaysOnTop: true,
    fullscreenable: false,
    skipTaskbar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  trayWindow.on('blur', () => {
    if (trayWindow && !trayWindow.isDestroyed()) trayWindow.hide()
  })

  if (isDev) {
    trayWindow.loadURL(`${devServerUrl}?tray=1`)
  } else {
    trayWindow.loadFile(path.join(__dirname, '../dist/index.html'), { search: 'tray=1' })
  }

  // Developer mode: auto-open DevTools for tray window too
  if (readAppSettings().devMode) {
    try { trayWindow.webContents.openDevTools() } catch {}
  }

  return trayWindow
}

function toggleTrayWindow() {
  if (!tray) return
  const win = ensureTrayWindow()
  if (win.isVisible()) {
    win.hide()
    return
  }

  const trayBounds = tray.getBounds()
  const winBounds = win.getBounds()
  const display = screen.getDisplayNearestPoint({ x: trayBounds.x, y: trayBounds.y })
  const { x: dx, y: dy, width: dw, height: dh } = display.workArea

  let x = Math.round(trayBounds.x + trayBounds.width / 2 - winBounds.width / 2)
  let y = Math.round(trayBounds.y + trayBounds.height + 6)

  x = Math.max(dx + 8, Math.min(x, dx + dw - winBounds.width - 8))
  y = Math.max(dy + 8, Math.min(y, dy + dh - winBounds.height - 8))

  win.setPosition(x, y, false)
  win.show()
  win.focus()
}

function setupTray() {
  if (process.platform !== 'darwin') return
  if (tray) return

  const iconPath = path.join(__dirname, 'tray-icon.png')
  let image = nativeImage.createFromPath(iconPath)
  if (!image.isEmpty()) {
    image = image.resize({ width: 18, height: 18 })
    image.setTemplateImage(true)
  }

  tray = new Tray(image)
  tray.setToolTip(app.name)
  tray.on('click', () => toggleTrayWindow())
  tray.on('right-click', () => {
    const menu = Menu.buildFromTemplate([
      { label: '打开主窗口', click: () => showMainWindow() },
      { type: 'separator' },
      { label: '退出', click: () => app.quit() }
    ])
    tray.popUpContextMenu(menu)
  })
}

// Ignore certificate errors for uniCloud static hosting domains.
// Electron 42's Chromium may reject their SSL config (handshake failed).
app.on('certificate-error', (event, _webContents, _url, _error, _certificate, callback) => {
  event.preventDefault()
  callback(true)
})

app.whenReady().then(() => {
  // Ensure core directories exist
  const appDataDir = path.join(app.getPath('userData'), 'appData')
  if (!fs.existsSync(appDataDir)) fs.mkdirSync(appDataDir, { recursive: true })

  Menu.setApplicationMenu(null)
  setupEventCenter()
  // Install system apps on first launch (idempotent, runs once ever)
  eventCenter.invoke('apps', 'ensureSeededApps', []).catch(() => {})
  createMainWindow()
  setupTray()
})

app.on('before-quit', () => {
  // Stop MQTT broker before quit
  eventCenter.invoke('mqttBroker', 'stop', []).catch(() => {})
  eventCenter.dispose()
})

app.on('activate', () => {
  showMainWindow()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
