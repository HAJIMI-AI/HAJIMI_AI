import { useCallback, useEffect, useRef, useState } from 'react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
} from '@/components/ui/card'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Switch } from '@/components/ui/switch'
import {
  ChevronDownIcon,
  SettingsIcon,
  ImageIcon,
  FileIcon,
  FolderOpenIcon,
  AlertCircleIcon,
  MessageSquareIcon,
  InfoIcon
} from 'lucide-react'
import { getEventCenter, getErrorMessage } from '@/lib/eventCenter'
import type { ClientConfig, ManagedAppItem, FilePreviewResult } from '@/lib/eventCenter'
import { ModelDebugView } from '@/components/ModelDebugView'
import { ModelManagementView } from '@/components/ModelManagementView'
import { ProfileSetupView } from '@/components/ProfileSetupView'
import { SkillManagementView } from '@/components/SkillManagementView'

function App() {
  const isTray =
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('tray') === '1'

  const isPreview =
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('preview') === '1'

  const previewFilePath =
    isPreview
      ? decodeURIComponent(new URLSearchParams(window.location.search).get('path') || '')
      : ''

  const [booting, setBooting] = useState(true)
  const [config, setConfig] = useState<ClientConfig | null>(null)
  const [fatal, setFatal] = useState<string | null>(null)
  const [accountInfoLoading, setAccountInfoLoading] = useState(false)

  const loadClientConfig = useCallback(async () => {
    const eventCenter = getEventCenter()
    if (!eventCenter?.getClientConfig) {
      throw new Error('未检测到 Electron eventCenter（请通过 Electron 启动应用）')
    }
    return await eventCenter.getClientConfig()
  }, [])

  useEffect(() => {
    let cancelled = false

    ;(async () => {
      try {
        const next = await loadClientConfig()
        if (cancelled) return
        setConfig(next)
        setFatal(null)
      } catch (e: unknown) {
        if (cancelled) return
        setFatal(getErrorMessage(e) || '读取本地配置失败')
      } finally {
        if (!cancelled) setBooting(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [loadClientConfig])

  useEffect(() => {
    if (isTray) return
    const eventCenter = getEventCenter()
    if (!eventCenter?.getLocalProfile) return
    if (!config?.userKey) return

    let cancelled = false
    ;(async () => {
      setAccountInfoLoading(true)
      try {
        const res = await eventCenter.getLocalProfile()
        if (cancelled) return
        setConfig((prev) =>
          prev
            ? { ...prev, userNickname: res.nickname, userAvatar: res.avatar }
            : prev
        )
      } catch {
        if (cancelled) return
      } finally {
        if (!cancelled) setAccountInfoLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [isTray, config?.userKey])

  let content: React.ReactNode

  if (isPreview) {
    content = <PreviewView filePath={previewFilePath} />
  } else if (isTray) {
    if (booting) {
      content = (
        <div className="min-h-dvh bg-background text-foreground">
          <div className="mx-auto w-full max-w-sm p-3">
            <Card>
              <CardHeader>
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-16" />
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-3">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-3 w-28" />
                  </div>
                </div>
              </CardContent>
              <CardFooter className="justify-end gap-2">
                <Skeleton className="h-9 w-16" />
                <Skeleton className="h-9 w-16" />
              </CardFooter>
            </Card>
          </div>
        </div>
      )
    } else if (fatal) {
      content = (
        <div className="min-h-dvh bg-background text-foreground">
          <div className="mx-auto w-full max-w-sm p-3">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">启动失败</CardTitle>
                <CardDescription>无法加载本地用户状态</CardDescription>
              </CardHeader>
              <CardContent>
                <Alert variant="destructive">
                  <AlertTitle>错误</AlertTitle>
                  <AlertDescription>{fatal}</AlertDescription>
                </Alert>
              </CardContent>
              <CardFooter className="justify-end">
                <Button
                  onClick={async () => {
                    setBooting(true)
                    setFatal(null)
                    try {
                      const next = await loadClientConfig()
                      setConfig(next)
                      setFatal(null)
                    } catch (e: unknown) {
                      setFatal(getErrorMessage(e) || '读取本地配置失败')
                    } finally {
                      setBooting(false)
                    }
                  }}
                >
                  重试
                </Button>
              </CardFooter>
            </Card>
          </div>
        </div>
      )
    } else {
      content = <TrayView config={config} />
    }
  } else if (booting || (accountInfoLoading && config?.userKey && !config.userNickname)) {
    content = (
      <div className="min-h-dvh bg-background text-foreground">
        <div className="mx-auto flex min-h-dvh max-w-6xl items-center px-6">
          <Card className="w-full">
            <CardHeader>
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-8 w-80 max-w-full" />
              <Skeleton className="h-5 w-[36rem] max-w-full" />
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-3">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  } else if (fatal) {
    content = (
      <div className="min-h-dvh bg-background text-foreground">
        <div className="mx-auto flex min-h-dvh max-w-3xl items-center px-6">
          <Card className="w-full">
            <CardHeader>
              <CardTitle>无法加载本地用户状态</CardTitle>
              <CardDescription>启动失败</CardDescription>
            </CardHeader>
            <CardContent>
              <Alert variant="destructive">
                <AlertTitle>错误</AlertTitle>
                <AlertDescription>{fatal}</AlertDescription>
              </Alert>
            </CardContent>
            <CardFooter className="justify-end">
              <Button
                onClick={async () => {
                  setBooting(true)
                  setFatal(null)
                  try {
                    const next = await loadClientConfig()
                    setConfig(next)
                    setFatal(null)
                  } catch (e: unknown) {
                    setFatal(getErrorMessage(e) || '读取本地配置失败')
                  } finally {
                    setBooting(false)
                  }
                }}
              >
                重试
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    )
  } else if (!config?.userKey) {
    content = (
      <ProfileSetupView
        onComplete={async () => {
          setBooting(true)
          try {
            // Reload config to pick up the new userKey
            const next = await loadClientConfig()
            setConfig(next)
            setFatal(null)
          } catch (e: unknown) {
            setFatal(getErrorMessage(e) || '读取本地配置失败')
          } finally {
            setBooting(false)
          }
        }}
      />
    )
  } else {
    content = (
      <MainView
        config={config}
        onRefresh={loadClientConfig}
        onSignOut={async () => {
          const eventCenter = getEventCenter()
          if (!eventCenter) return
          await eventCenter.signOut()
          setBooting(true)
          try {
            const next = await loadClientConfig()
            setConfig(next)
            setFatal(null)
          } catch (e: unknown) {
            setFatal(getErrorMessage(e) || '读取本地配置失败')
          } finally {
            setBooting(false)
          }
        }}
      />
    )
  }

  return <TooltipProvider delayDuration={600}>{content}</TooltipProvider>
}

function PreviewView({ filePath }: { filePath: string }) {
  const [result, setResult] = useState<FilePreviewResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (!filePath) {
        setError('未指定文件路径')
        setLoading(false)
        return
      }
      const eventCenter = getEventCenter()
      if (!eventCenter) {
        setError('未检测到 Electron eventCenter')
        setLoading(false)
        return
      }
      setLoading(true)
      setError(null)
      try {
        const res = await eventCenter.previewFile({ path: filePath, maxTextBytes: 512 * 1024, maxImageDim: 1600 })
        if (cancelled) return
        if (res.type === 'binary') {
          setResult(res)
          setError('此文件类型不支持预览')
        } else {
          setResult(res)
        }
      } catch (e: unknown) {
        if (cancelled) return
        setError(getErrorMessage(e) || '预览失败')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [filePath])

  // ESC to close the preview window
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        window.close()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const displayName = result?.name || filePath.split('/').pop() || filePath.split('\\').pop() || '文件预览'

  // Sync document title (overrides the static <title> from index.html)
  useEffect(() => {
    document.title = displayName
  }, [displayName])

  function formatSize(bytes: number) {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <div className="h-dvh bg-background text-foreground flex flex-col overflow-hidden">
      {/* Title bar */}
      <div className="app-region-drag flex items-center justify-between px-4 py-2 border-b shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          {result?.type === 'image'
            ? <ImageIcon className="size-4 text-muted-foreground shrink-0" />
            : <FileIcon className="size-4 text-muted-foreground shrink-0" />
          }
          <span className="text-sm font-medium truncate">{displayName}</span>
        </div>
        <div className="app-region-no-drag flex items-center gap-1 text-xs text-muted-foreground">
          {result?.type === 'image' && result.width ? (
            <span>{result.width}×{result.height} · {result.mimeType}</span>
          ) : result?.type === 'text' && result.language ? (
            <span>{result.language}{result.truncated ? ' (已截断)' : ''}</span>
          ) : null}
          {result ? <span className="ml-2">{formatSize(result.sizeBytes)}</span> : null}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0">
        {loading ? (
          <div className="flex items-center justify-center h-full p-8">
            <Skeleton className="h-60 w-full max-w-3xl" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 p-8 text-center">
            <FileIcon className="size-10 text-muted-foreground" />
            <div>
              <div className="text-sm font-medium">{error}</div>
              <div className="text-xs text-muted-foreground mt-1 break-all">{filePath}</div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                const ec = getEventCenter()
                if (ec) {
                  ec.showItemInFolder({ path: filePath }).catch(() => { /* ignore */ })
                }
              }}
            >
              <FolderOpenIcon className="size-3.5 mr-1" />
              打开文件目录
            </Button>
          </div>
        ) : result?.type === 'image' && result.base64 ? (
          <img
            src={result.base64}
            alt={result.name}
            className="w-full h-full object-contain"
          />
        ) : result?.type === 'text' && result.content ? (
          <pre className="h-full overflow-auto p-4 m-0 text-sm leading-relaxed whitespace-pre-wrap break-all font-mono">
            <code>{result.content}</code>
          </pre>
        ) : null}
      </div>
    </div>
  )
}

function TrayView(_props: { config: ClientConfig | null }) {
  const eventCenter = getEventCenter()
  const [search, setSearch] = useState('')
  const [apps, setApps] = useState<ManagedAppItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [openingId, setOpeningId] = useState<string | null>(null)
  const [runningApps, setRunningApps] = useState<Set<string>>(new Set())
  const [trayContextMenu, setTrayContextMenu] = useState<{ appId: string; appPinned: boolean; x: number; y: number } | null>(null)

  const loadTrayApps = async () => {
    if (!eventCenter) return
    try {
      const [res, running] = await Promise.all([
        eventCenter.invoke('apps', 'list', []) as Promise<{ apps: ManagedAppItem[] }>,
        eventCenter.getRunningApps().catch(() => ({ running: [] as string[] }))
      ])
      setApps(Array.isArray(res?.apps) ? res.apps : [])
      setRunningApps(new Set(running?.running || []))
    } catch {}
  }

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (!eventCenter) { setLoading(false); return }
      setLoading(true)
      setError(null)
      try {
        await loadTrayApps()
      } catch (e: unknown) {
        if (cancelled) return
        setError(getErrorMessage(e) || '加载失败')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  // Listen for apps-refresh from main window
  useEffect(() => {
    if (!eventCenter) return
    const handler = () => { void loadTrayApps() }
    window.addEventListener('apps-refresh', handler)
    return () => window.removeEventListener('apps-refresh', handler)
  }, [])

  // Refresh running state on focus — no full list reload
  useEffect(() => {
    if (!eventCenter) return
    const handler = async () => {
      try {
        const r = await eventCenter.getRunningApps().catch(() => ({ running: [] as string[] }))
        setRunningApps(new Set(r?.running || []))
      } catch {}
    }
    window.addEventListener('focus', handler)
    return () => window.removeEventListener('focus', handler)
  }, [])

  // Close tray context menu on outside click
  useEffect(() => {
    if (!trayContextMenu) return
    const handle = () => setTrayContextMenu(null)
    window.addEventListener('click', handle)
    return () => window.removeEventListener('click', handle)
  }, [trayContextMenu])

  const filtered = search.trim()
    ? apps.filter((a) => {
        const q = search.toLowerCase()
        return (
          (a.alias && a.alias.toLowerCase().includes(q)) ||
          (a.hsq?.appName && a.hsq.appName.toLowerCase().includes(q)) ||
          (a.hsq?.appId && a.hsq.appId.toLowerCase().includes(q))
        )
      })
    : apps

  return (
    <div className="min-h-dvh bg-background text-foreground flex flex-col">
      {/* Search bar */}
      <div className="px-3 pt-3 pb-2">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="搜索应用…"
          autoFocus
          className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
      </div>

      {/* App list */}
      <div className="flex-1 overflow-auto px-3 pb-3">
        {loading ? (
          <div className="flex flex-col gap-1.5">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-12 w-full rounded-md" />
            ))}
          </div>
        ) : error ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <AlertCircleIcon className="size-6 text-destructive" />
            <p className="text-xs text-muted-foreground">{error}</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <MessageSquareIcon className="size-6 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">
              {search.trim() ? '无匹配应用' : '暂无应用'}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            {filtered.map((a) => {
              const isRunning = runningApps.has(a.hsq?.appId || '')
              return (
              <button
                key={a.id}
                disabled={openingId === a.id}
                onClick={async () => {
                  if (!eventCenter || !a.hsq?.appId) return
                  setOpeningId(a.id)
                  try {
                    await eventCenter.focusOrOpenPopup({ appId: a.hsq.appId })
                    setRunningApps((prev) => { const n = new Set(prev); n.add(a.hsq.appId); return n })
                  } catch {
                    // Ignore — window may have been closed
                  } finally {
                    setOpeningId(null)
                  }
                }}
                onContextMenu={a.hsq?.appId === 'self_shop' ? undefined : (e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  setTrayContextMenu({ appId: a.id, appPinned: a.pinned === true, x: e.clientX, y: e.clientY })
                }}
                className="flex items-center gap-2.5 w-full rounded-md px-3 py-2 text-left transition-colors hover:bg-muted/60 active:bg-muted disabled:opacity-50"
              >
                <div className="shrink-0 relative">
                  <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center text-xs font-medium text-primary overflow-hidden">
                    {a.iconBase64 ? (
                      <img src={a.iconBase64} alt="" className="w-full h-full object-cover" />
                    ) : (
                      (a.alias || a.hsq?.appName || '?')[0].toUpperCase()
                    )}
                  </div>
                  {isRunning ? (
                    <span className="absolute -top-1 -right-1 size-2.5 rounded-full bg-green-500 border-2 border-background" title="运行中" />
                  ) : null}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate flex items-center gap-1">
                    {a.alias || a.hsq?.appName || '未命名'}
                    {a.pinned === true ? (
                      <span className="shrink-0 text-amber-500 text-[10px]" title="已置顶">★</span>
                    ) : null}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {a.hsq?.appName || a.hsq?.appId || ''}
                    {a.hsq?.appVersion ? ` · v${a.hsq.appVersion}` : ''}
                  </div>
                </div>
                {openingId === a.id ? (
                  <span className="shrink-0 size-4 border-2 border-muted-foreground/30 border-t-muted-foreground rounded-full animate-spin" />
                ) : null}
                {isRunning ? (
                  <span className="shrink-0 size-2 rounded-full bg-green-500" title="运行中" />
                ) : null}
              </button>
              )
            })}

            {/* Tray context menu */}
            {trayContextMenu ? (
              <div
                className="fixed z-50 min-w-[120px] rounded-xl border bg-popover p-1.5 shadow-xl animate-in fade-in-0 zoom-in-95"
                style={{ left: trayContextMenu.x - 60, top: trayContextMenu.y - 10 }}
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  className="w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-accent transition-colors"
                  onClick={async () => {
                    const { appId, appPinned } = trayContextMenu
                    setTrayContextMenu(null)
                    try {
                      await eventCenter?.pinApp?.({ id: appId, pinned: !appPinned })
                      await loadTrayApps()
                    } catch {}
                  }}
                >
                  {trayContextMenu.appPinned ? '取消置顶' : '置顶'}
                </button>
              </div>
            ) : null}
          </div>
        )}
      </div>

      {/* Footer actions */}
      <div className="px-3 pb-3 flex gap-2">
        <Button
          variant="outline"
          size="sm"
          className="flex-1"
          onClick={async () => {
            if (!eventCenter) return
            await eventCenter.invoke('app', 'showMain', [])
          }}
        >
          打开主窗口
        </Button>
        <Button
          variant="destructive"
          size="sm"
          onClick={async () => {
            if (!eventCenter) return
            await eventCenter.invoke('app', 'quit', [])
          }}
        >
          退出
        </Button>
      </div>
    </div>
  )
}

function MainView({
  config,
  onRefresh,
  onSignOut
}: {
  config: ClientConfig
  onRefresh: () => Promise<ClientConfig>
  onSignOut: () => Promise<void>
}) {
  const isMac = typeof navigator !== 'undefined' && /Mac/i.test(navigator.platform)
  const userKey = config.userKey || ''
  const displayName = config.userNickname || userKey
  const userAvatar = config.userAvatar || null
  const avatarText = displayName ? displayName.slice(0, 2).toUpperCase() : 'U'
  const [environmentOpen, setEnvironmentOpen] = useState(false)
  const [devMode, setDevMode] = useState(config.devMode === true)
  const settingsTriggerRef = useRef<HTMLButtonElement>(null)

  const [settingsMenuOpen, setSettingsMenuOpen] = useState(false)
  const [activeView, setActiveView] = useState<'skills' | 'debug' | 'models' | null>(null)
  const [appsOpen, setAppsOpen] = useState(false)
  const [appsLoading, setAppsLoading] = useState(false)
  const [appsSaving, setAppsSaving] = useState(false)
  const [appsError, setAppsError] = useState<string | null>(null)
  const [apps, setApps] = useState<ManagedAppItem[]>([])
  const [editingAppId, setEditingAppId] = useState<string | null>(null)
  const [appAlias, setAppAlias] = useState('')
  const [appDirectory, setAppDirectory] = useState('')
  const [importMode, setImportMode] = useState<'local' | 'fingerprint' | 'remote'>('local')
  const [appFingerprint, setAppFingerprint] = useState('')
  const [appRemoteUrl, setAppRemoteUrl] = useState('')
  const [conflictApp, setConflictApp] = useState<ManagedAppItem | null>(null)
  const [deleteAppId, setDeleteAppId] = useState<string | null>(null)
  const [noModelAppId, setNoModelAppId] = useState<string | null>(null)
  const [runningApps, setRunningApps] = useState<Set<string>>(new Set())
  const [appContextMenu, setAppContextMenu] = useState<{ appId: string; x: number; y: number } | null>(null)
  const [envMode, setEnvMode] = useState<'local' | 'mqtt'>(
    config.mode === 'mqtt' || config.mode === 'both' ? 'mqtt' : 'local'
  )
  const [mqttUrl, setMqttUrl] = useState(config.mqtt?.url || '')
  const [mqttUsername, setMqttUsername] = useState(config.mqtt?.username || '')
  const [mqttPassword, setMqttPassword] = useState(config.mqtt?.password || '')
  const [mqttFormOpen, setMqttFormOpen] = useState(!config.mqtt?.url)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; latencyMs?: number; error?: string | null } | null>(null)
  const [saving, setSaving] = useState(false)
  const [envError, setEnvError] = useState<string | null>(null)

  // Local MQTT Broker settings
  const [brokerEnabled, setBrokerEnabled] = useState(true)
  const [brokerPort, setBrokerPort] = useState('1883')
  const [brokerUsername, setBrokerUsername] = useState('')
  const [brokerPassword, setBrokerPassword] = useState('')
  const [brokerStatus, setBrokerStatus] = useState<{ running: boolean; clientCount: number } | null>(null)
  const [brokerConfigOpen, setBrokerConfigOpen] = useState(false)
  const [brokerClientsOpen, setBrokerClientsOpen] = useState(false)
  const [brokerClients, setBrokerClients] = useState<Array<{ id: string; address: string; connectedAt: number }>>([])

  // Sync envMode + MQTT form fields when config loads
  useEffect(() => {
    if (!config) return
    setEnvMode(config.mode === 'mqtt' || config.mode === 'both' ? 'mqtt' : 'local')
    setMqttUrl(config.mqtt?.url || '')
    setMqttUsername(config.mqtt?.username || '')
    setMqttPassword(config.mqtt?.password || '')
    setMqttFormOpen(!config.mqtt?.url)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config?.mode, config?.mqtt?.url])

  async function loadApps(reload?: boolean) {
    const eventCenter = getEventCenter()
    if (!eventCenter) {
      setAppsError('未检测到 Electron eventCenter')
      return
    }
    setAppsLoading(true)
    setAppsError(null)
    try {
      const [res, running] = await Promise.all([
        eventCenter.invoke('apps', 'list', [reload ? { reload: true } : {}]) as Promise<{ apps: ManagedAppItem[] }>,
        eventCenter.getRunningApps().catch(() => ({ running: [] as string[] }))
      ])
      setApps(Array.isArray(res?.apps) ? res.apps : [])
      setRunningApps(new Set(running?.running || []))
    } catch (e: unknown) {
      setAppsError(getErrorMessage(e) || '加载失败')
    } finally {
      setAppsLoading(false)
    }
  }

  /** Save/import app. Handles conflict detection: if an app with the same appId already
   *  exists, shows a confirmation dialog. Call with { overwrite: true } to force update. */
  async function doSaveApp(overwrite = false) {
    const eventCenter = getEventCenter()
    if (!eventCenter) return
    setAppsSaving(true)
    setAppsError(null)
    try {
      let res: { app?: ManagedAppItem; conflict?: boolean; existingApp?: ManagedAppItem; updated?: boolean }
      if (editingAppId) {
        const dir = importMode === 'remote' ? appRemoteUrl.trim() : appDirectory.trim()
        res = await eventCenter.invoke('apps', 'update', [
          { id: editingAppId, alias: appAlias.trim(), directory: dir }
        ]) as { app: ManagedAppItem }
      } else if (importMode === 'fingerprint') {
        res = await eventCenter.invoke('apps', 'importByFingerprint', [
          { fingerprint: appFingerprint.trim(), alias: appAlias.trim(), overwrite }
        ]) as { app?: ManagedAppItem; conflict?: boolean; existingApp?: ManagedAppItem }
      } else if (importMode === 'remote') {
        res = await eventCenter.invoke('apps', 'importByUrl', [
          { url: appRemoteUrl.trim(), alias: appAlias.trim(), overwrite }
        ]) as { app?: ManagedAppItem; conflict?: boolean; existingApp?: ManagedAppItem }
      } else {
        res = await eventCenter.invoke('apps', 'create', [
          { alias: appAlias.trim(), directory: appDirectory.trim(), overwrite }
        ]) as { app?: ManagedAppItem; conflict?: boolean; existingApp?: ManagedAppItem }
      }

      // Handle conflict — show confirmation dialog
      if (res?.conflict && res?.existingApp) {
        setConflictApp(res.existingApp)
        setAppsSaving(false)
        return
      }

      setEditingAppId(null)
      setAppAlias('')
      setAppDirectory('')
      setAppFingerprint('')
      setAppRemoteUrl('')
      setImportMode('local')
      setConflictApp(null)
      await loadApps()
      await onRefresh()
      setAppsOpen(false)
    } catch (e: unknown) {
      setAppsError(getErrorMessage(e) || '保存失败')
    } finally {
      setAppsSaving(false)
    }
  }

  async function handleToggleDevMode() {
    const eventCenter = getEventCenter()
    if (!eventCenter) return
    const next = !devMode
    try {
      await eventCenter.setDevMode(next)
      setDevMode(next)
    } catch {
      // Ignore — toggle failure shouldn't block the UI
    }
  }

  useEffect(() => {
    if (!userKey) return
    const t = window.setTimeout(() => {
      void loadApps()
    }, 0)
    return () => window.clearTimeout(t)
  }, [userKey])

  // Load broker config on mount
  useEffect(() => {
    loadBrokerConfig()
  }, [])

  // Full list refresh — child app calls refreshMainAppList() after installing an app
  useEffect(() => {
    if (!userKey) return
    const handler = () => { void loadApps(true) }
    window.addEventListener('apps-refresh', handler)
    return () => window.removeEventListener('apps-refresh', handler)
  }, [userKey])

  // Running state only — refresh on window focus (user switches back after closing an app)
  useEffect(() => {
    if (!userKey) return
    const refreshRunning = async () => {
      const ec = getEventCenter()
      try {
        const r = await ec?.getRunningApps?.().catch(() => ({ running: [] as string[] }))
        setRunningApps(new Set(r?.running || []))
      } catch {}
    }
    window.addEventListener('focus', refreshRunning)
    return () => window.removeEventListener('focus', refreshRunning)
  }, [userKey])

  // Close app context menu on outside click
  useEffect(() => {
    if (!appContextMenu) return
    const handle = () => setAppContextMenu(null)
    window.addEventListener('click', handle)
    window.addEventListener('contextmenu', handle)
    return () => {
      window.removeEventListener('click', handle)
      window.removeEventListener('contextmenu', handle)
    }
  }, [appContextMenu])


  async function testMqtt() {
    const eventCenter = getEventCenter()
    if (!eventCenter) {
      setEnvError('未检测到 Electron eventCenter')
      return
    }
    setTesting(true)
    setEnvError(null)
    setTestResult(null)
    try {
      const res = (await eventCenter.invoke('eventCenter', 'testMqttConnection', [
        {
          url: mqttUrl,
          username: mqttUsername || undefined,
          password: mqttPassword || undefined,
          timeoutMs: 6000
        }
      ])) as { ok: boolean; latencyMs?: number; error?: string | null }
      setTestResult(res)
      if (!res.ok) setEnvError(res.error || '连接失败')
    } catch (e: unknown) {
      setEnvError(getErrorMessage(e) || '连接失败')
    } finally {
      setTesting(false)
    }
  }

  async function saveEnvironment() {
    const eventCenter = getEventCenter()
    if (!eventCenter) { setEnvError('未检测到 Electron eventCenter'); return }
    setSaving(true)
    setEnvError(null)
    try {
      // Save broker config first
      await persistBrokerConfig()

      // Handle event mode — MQTT client remote is separate from local broker
      if (envMode === 'mqtt') {
        // MQTT client remote mode — pass mqtt config directly to setEventMode
        if (!mqttUrl.trim()) throw new Error('请填写 MQTT 地址')
        if (!testResult?.ok) throw new Error('请先测试 MQTT 连接成功')
        await eventCenter.invoke('eventCenter', 'setEventMode', [{
          mode: 'mqtt',
          mqtt: { url: mqttUrl, username: mqttUsername || undefined, password: mqttPassword || undefined }
        }])
      } else {
        await eventCenter.invoke('eventCenter', 'setEventMode', [{ mode: 'ipc' }])
      }

      const next = await onRefresh()
      setEnvMode(next.mode === 'mqtt' || next.mode === 'both' ? 'mqtt' : 'local')
      setMqttUrl(next.mqtt?.url || '')
      setMqttUsername(next.mqtt?.username || '')
      setMqttPassword(next.mqtt?.password || '')
      setEnvironmentOpen(false)
    } catch (e: unknown) {
      setEnvError(getErrorMessage(e) || '保存失败')
    } finally {
      setSaving(false)
    }
  }

  async function loadBrokerConfig() {
    const eventCenter = getEventCenter()
    if (!eventCenter) return
    try {
      const [cfg, status] = await Promise.all([
        eventCenter.getMqttBrokerConfig(),
        eventCenter.getMqttBrokerStatus()
      ])
      setBrokerEnabled(cfg.enabled)
      setBrokerPort(String(cfg.port))
      setBrokerUsername(cfg.username || '')
      setBrokerPassword('') // never expose password from backend
      setBrokerStatus({ running: status.running, clientCount: status.clientCount })
    } catch {
      // ignore — broker module may not be available
    }
  }

  async function loadBrokerClients() {
    const eventCenter = getEventCenter()
    if (!eventCenter) return
    try {
      const res = await eventCenter.listMqttBrokerClients()
      setBrokerClients(res.clients || [])
    } catch {
      // ignore
    }
  }

  /** Persist broker config via IPC (no UI state, returns result) */
  async function persistBrokerConfig() {
    const ec = getEventCenter()!
    const port = parseInt(brokerPort, 10)
    if (isNaN(port) || port < 1024 || port > 65535) {
      throw new Error('端口号需在 1024–65535 之间')
    }
    const input: Record<string, unknown> = { enabled: brokerEnabled, port }
    if (brokerUsername.trim()) input.username = brokerUsername.trim()
    else input.username = ''
    if (brokerPassword) input.password = brokerPassword
    else input.password = ''

    const res = await ec.updateMqttBrokerConfig(input as Parameters<typeof ec.updateMqttBrokerConfig>[0])
    setBrokerEnabled(res.config.enabled)
    setBrokerPort(String(res.config.port))
    setBrokerUsername(res.config.username || '')
    setBrokerPassword('')
    const s = await ec.getMqttBrokerStatus()
    setBrokerStatus({ running: s.running, clientCount: s.clientCount })
  }

  async function saveBrokerConfig() {
    const eventCenter = getEventCenter()
    if (!eventCenter) { setEnvError('未检测到 Electron eventCenter'); return }
    setSaving(true)
    setEnvError(null)
    try {
      await persistBrokerConfig()
      setBrokerConfigOpen(false)
    } catch (e: unknown) {
      setEnvError(getErrorMessage(e) || '保存失败')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-dvh bg-background text-foreground">
      {/* Settings header bar — visible on all platforms.
          macOS: draggable region for hiddenInset titlebar + traffic lights.
          Windows/Linux: static bar with border below native titlebar. */}
      <div
        className={`fixed top-0 left-0 right-0 z-50 h-12 flex items-center justify-end px-3 ${isMac ? 'app-region-drag' : 'border-b bg-background/80 backdrop-blur-sm'}`}
      >
        <div
          className={`flex items-center gap-1 ${isMac ? 'app-region-no-drag' : ''}`}
        >
          <DropdownMenu
            open={settingsMenuOpen}
            onOpenChange={(open) => {
              setSettingsMenuOpen(open)
              if (!open) settingsTriggerRef.current?.blur()
            }}
          >
            <DropdownMenuTrigger asChild>
              <Button
                ref={settingsTriggerRef}
                variant="ghost"
                size="icon"
                aria-label="设置"
                className="focus-visible:ring-0 focus-visible:border-transparent"
              >
                <SettingsIcon />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuGroup>
                <DropdownMenuItem
                  onSelect={() => { setSettingsMenuOpen(false); setActiveView('skills') }}
                >
                  技能管理
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => { setSettingsMenuOpen(false); setActiveView('debug') }}
                >
                  模型调试
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onSelect={() => {
                    setSettingsMenuOpen(false)
                    setActiveView('models')
                  }}
                >
                  模型管理
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => {
                    setSettingsMenuOpen(false)
                    const isMqtt = config.mode === 'mqtt' || config.mode === 'both'
                    setEnvMode(isMqtt ? 'mqtt' : 'local')
                    setMqttUrl(config.mqtt?.url || ''); setMqttUsername(config.mqtt?.username || '')
                    setMqttPassword(config.mqtt?.password || ''); setMqttFormOpen(!config.mqtt?.url)
                    setTesting(false); setTestResult(null); setSaving(false); setEnvError(null)
                    setEnvironmentOpen(true)
                  }}
                >
                  环境设置
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuCheckboxItem
                  checked={devMode}
                  onSelect={(e) => {
                    e.preventDefault()
                    handleToggleDevMode()
                  }}
                >
                  开发者模式
                </DropdownMenuCheckboxItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="用户菜单" className="focus-visible:ring-0 focus-visible:border-transparent">
                <Avatar size="sm">
                                  {userAvatar ? <AvatarImage src={userAvatar} alt={displayName || ''} /> : null}
                  <AvatarFallback>{avatarText}</AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>{displayName || userKey}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onSelect={(e) => {
                  e.preventDefault()
                  onSignOut()
                }}
              >
                退出登录
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>


      <Dialog
        open={appsOpen}
        onOpenChange={(open) => {
          setAppsOpen(open)
          if (!open) {
            setAppsError(null)
            setAppsSaving(false)
            setEditingAppId(null)
            setAppAlias('')
            setAppDirectory('')
            setImportMode('local')
            setAppFingerprint('')
            setAppRemoteUrl('')
            setConflictApp(null)
          }
        }}
      >
        <DialogContent className="max-w-3xl max-h-[calc(100dvh-4rem)] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingAppId ? '编辑应用' : '新增应用'}</DialogTitle>
            <DialogDescription>
              {importMode === 'local'
                ? '选择目录并读取 hsq.config.json（需包含 appId）'
                : importMode === 'fingerprint'
                  ? '输入应用指纹，自动下载并导入应用包'
                  : '输入远程 URL，系统将读取 URL/hsq.config.json 进行加载'}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4">
            {/* Import mode selector — only show when adding new (not editing) */}
            {!editingAppId ? (
              <div className="flex flex-col gap-2">
                <div className="text-sm font-medium">导入模式</div>
                <ToggleGroup
                  type="single"
                  value={importMode}
                  onValueChange={(v) => {
                    if (v === 'local' || v === 'fingerprint' || v === 'remote') {
                      setImportMode(v)
                      setAppsError(null)
                    }
                  }}
                  className="w-full"
                >
                  <ToggleGroupItem value="local" className="flex-1 justify-center">
                    本地导入
                  </ToggleGroupItem>
                  <ToggleGroupItem value="fingerprint" className="flex-1 justify-center">
                    指纹导入
                  </ToggleGroupItem>
                  <ToggleGroupItem value="remote" className="flex-1 justify-center">
                    远程导入
                  </ToggleGroupItem>
                </ToggleGroup>
              </div>
            ) : null}

            <Card>
              <CardHeader>
                <CardTitle className="text-base">基础信息</CardTitle>
                <CardDescription>应用别名仅用于本系统展示</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col gap-3">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="appAlias">应用别名</Label>
                    <Input
                      id="appAlias"
                      value={appAlias}
                      onChange={(e) => {
                        setAppAlias(e.target.value)
                        setAppsError(null)
                      }}
                      placeholder="例如：我的应用A"
                    />
                  </div>

                  {/* Mode: 本地导入 */}
                  {importMode === 'local' ? (
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="appDirectory">应用目录</Label>
                      <div className="flex items-center gap-2">
                        <Input id="appDirectory" value={appDirectory} readOnly placeholder="请选择目录" />
                        <Button
                          variant="outline"
                          onClick={async () => {
                            const eventCenter = getEventCenter()
                            if (!eventCenter) return
                            try {
                              const res = (await eventCenter.invoke('apps', 'pickDirectory', [])) as { directory: string | null }
                              if (res?.directory) setAppDirectory(res.directory)
                            } catch (e: unknown) {
                              setAppsError(getErrorMessage(e) || '选择目录失败')
                            }
                          }}
                        >
                          选择目录
                        </Button>
                      </div>
                    </div>
                  ) : null}

                  {/* Mode: 指纹导入 */}
                  {importMode === 'fingerprint' ? (
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="appFingerprint">应用指纹</Label>
                      <Input
                        id="appFingerprint"
                        value={appFingerprint}
                        onChange={(e) => {
                          setAppFingerprint(e.target.value)
                          setAppsError(null)
                        }}
                        placeholder="例如：abc123-def456"
                      />
                      <p className="text-xs text-muted-foreground">
                        将从 CDN 下载 并自动解压导入
                      </p>
                    </div>
                  ) : null}

                  {/* Mode: 远程导入 */}
                  {importMode === 'remote' ? (
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="appRemoteUrl">远程地址</Label>
                      <Input
                        id="appRemoteUrl"
                        value={appRemoteUrl}
                        onChange={(e) => {
                          setAppRemoteUrl(e.target.value)
                          setAppsError(null)
                        }}
                        placeholder="例如：https://example.com/my-app"
                      />
                      <p className="text-xs text-muted-foreground">
                        系统将请求 <code className="text-xs bg-muted px-1 rounded">/hsq.config.json</code> 验证应用配置，加载时直接使用该 URL 作为主应用地址
                      </p>
                    </div>
                  ) : null}

                  {appsError ? (
                    <Alert variant="destructive">
                      <AlertTitle>操作失败</AlertTitle>
                      <AlertDescription>{appsError}</AlertDescription>
                    </Alert>
                  ) : null}
                </div>
              </CardContent>
              <CardFooter className="justify-end gap-2">
                <Button
                  variant="outline"
                  disabled={appsSaving}
                  onClick={() => {
                    setEditingAppId(null)
                    setAppAlias('')
                    setAppDirectory('')
                    setAppFingerprint('')
                    setAppRemoteUrl('')
                    setImportMode('local')
                    setAppsError(null)
                  }}
                >
                  重置
                </Button>
                <Button
                  disabled={
                    appsSaving ||
                    !appAlias.trim() ||
                    (importMode === 'local' && !appDirectory.trim()) ||
                    (importMode === 'fingerprint' && !appFingerprint.trim()) ||
                    (importMode === 'remote' && !appRemoteUrl.trim())
                  }
                  onClick={async () => {
                    const eventCenter = getEventCenter()
                    if (!eventCenter) return
                    await doSaveApp()
                  }}
                >
                  {appsSaving ? '保存中…' : '保存'}
                </Button>
              </CardFooter>
            </Card>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(deleteAppId)} onOpenChange={(open) => (!open ? setDeleteAppId(null) : null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>删除后将无法恢复，确定继续吗？</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteAppId(null)}>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                const id = deleteAppId
                setDeleteAppId(null)
                if (!id) return
                const eventCenter = getEventCenter()
                if (!eventCenter) return
                setAppsError(null)
                try {
                  await eventCenter.invoke('apps', 'remove', [{ id }])
                  await loadApps()
                } catch (e: unknown) {
                  setAppsError(getErrorMessage(e) || '删除失败')
                }
              }}
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Conflict confirmation — app with same appId already exists */}
      <AlertDialog open={Boolean(conflictApp)} onOpenChange={(open) => (!open ? setConflictApp(null) : null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>应用已存在</AlertDialogTitle>
            <AlertDialogDescription>
              应用「{conflictApp?.alias || conflictApp?.hsq?.appName || conflictApp?.hsq?.appId || '未知'}」（ID: {conflictApp?.hsq?.appId || '-'}）已经存在，是否用新导入的内容更新它？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setConflictApp(null)}>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                setConflictApp(null)
                await doSaveApp(true)
              }}
            >
              更新
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* No-model warning dialog */}
      <AlertDialog open={Boolean(noModelAppId)} onOpenChange={(open) => (!open ? setNoModelAppId(null) : null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>未配置 AI 模型</AlertDialogTitle>
            <AlertDialogDescription>
              当前尚未配置任何 AI 模型。除应用商店外，其他应用依赖 AI 模型运行。请先前往模型管理页面至少添加一个模型。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setNoModelAppId(null)}>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setNoModelAppId(null)
                setActiveView('models')
              }}
            >
              前往模型管理
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={environmentOpen} onOpenChange={setEnvironmentOpen}>
        <DialogContent className="max-w-2xl max-h-[calc(100dvh-4rem)] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>环境设置</DialogTitle>
            <DialogDescription>本机运行参数与 MQTT 配置</DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">运行环境</CardTitle>
                <CardDescription>切换事件模式</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col gap-4">
                  <div className="text-sm font-medium">运行模式</div>
                  <ToggleGroup
                    type="single"
                    value={envMode}
                    onValueChange={(v) => {
                      if (v === 'local') setEnvMode(v)
                      if (v === 'mqtt' && config.mqttEnabled) {
                        setEnvMode(v)
                        const hasConfigured = Boolean((mqttUrl || config.mqtt?.url || '').trim())
                        setMqttFormOpen(!hasConfigured)
                      }
                      setEnvError(null)
                      setTestResult(null)
                    }}
                    className="w-full"
                  >
                    <ToggleGroupItem value="local" className="flex-1 justify-center">
                      本地模式
                    </ToggleGroupItem>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="flex-1">
                          <ToggleGroupItem
                            value="mqtt"
                            className="w-full justify-center"
                            disabled={!config.mqttEnabled}
                          >
                            MQTT 模式
                          </ToggleGroupItem>
                        </span>
                      </TooltipTrigger>
                      {!config.mqttEnabled ? (
                        <TooltipContent sideOffset={8}>{config.mqttDisabledReason || 'MQTT 不可用'}</TooltipContent>
                      ) : null}
                    </Tooltip>
                  </ToggleGroup>
                </div>
              </CardContent>
            </Card>

            {/* ── 本机 MQTT 服务 ── */}
            <Card>
              <CardContent className="flex items-center justify-between py-4">
                <div className="flex items-center gap-3">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-medium">本机 MQTT 服务</span>
                    <span className="text-xs text-muted-foreground">
                      {brokerStatus?.running
                        ? `运行中 · 端口 ${brokerPort}`
                        : brokerEnabled ? '正在启动…' : '已停止'}
                    </span>
                  </div>
                  {brokerStatus?.running && brokerStatus.clientCount > 0 ? (
                    <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
                      {brokerStatus.clientCount} 个客户端
                    </span>
                  ) : null}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="MQTT 服务设置"
                    onClick={() => {
                      loadBrokerConfig()
                      setEnvError(null)
                      setBrokerConfigOpen(true)
                    }}
                  >
                    <SettingsIcon className="size-3.5" />
                  </Button>
                  <Switch
                    checked={brokerEnabled}
                    onCheckedChange={async (on) => {
                      setBrokerEnabled(on)
                      setEnvError(null)
                      const ec = getEventCenter()
                      if (!ec) return
                      try {
                        // updateConfig will auto start/stop based on enabled flag
                        const port = parseInt(brokerPort, 10) || 1883
                        await ec.updateMqttBrokerConfig({ enabled: on, port })
                        const s = await ec.getMqttBrokerStatus()
                        setBrokerStatus({ running: s.running, clientCount: s.clientCount })
                      } catch (e: unknown) {
                        setBrokerEnabled(!on) // revert on failure
                        setEnvError(getErrorMessage(e) || '操作失败')
                      }
                    }}
                  />
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="查看连接的客户端"
                    onClick={() => {
                      loadBrokerClients()
                      setBrokerClientsOpen(true)
                    }}
                  >
                    <InfoIcon className="size-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>

            {envMode === 'mqtt' ? (
              <Card>
                <Collapsible open={mqttFormOpen} onOpenChange={setMqttFormOpen}>
                  <CardHeader className="flex flex-row items-start justify-between gap-4">
                    <div className="flex min-w-0 flex-col gap-1">
                      <CardTitle className="text-base">MQTT</CardTitle>
                      <CardDescription className="truncate">
                        {mqttUrl.trim() ? mqttUrl.trim() : '未配置'}
                      </CardDescription>
                    </div>
                    <CollapsibleTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={mqttFormOpen ? '折叠 MQTT 配置' : '展开 MQTT 配置'}
                      >
                        <ChevronDownIcon className={mqttFormOpen ? 'transition-transform rotate-180' : 'transition-transform'} />
                      </Button>
                    </CollapsibleTrigger>
                  </CardHeader>
                  <CollapsibleContent>
                    <CardContent>
                      <div className="flex flex-col gap-4">
                        <div className="flex flex-col gap-2">
                          <Label htmlFor="envMqttUrl">MQTT 地址</Label>
                          <Input
                            id="envMqttUrl"
                            value={mqttUrl}
                            onChange={(e) => {
                              setMqttUrl(e.target.value)
                              setTestResult(null)
                            }}
                            placeholder="mqtt://host:1883"
                            autoComplete="off"
                            spellCheck={false}
                          />
                        </div>
                        <div className="flex flex-col gap-2">
                          <Label htmlFor="envMqttUsername">用户名</Label>
                          <Input
                            id="envMqttUsername"
                            value={mqttUsername}
                            onChange={(e) => {
                              setMqttUsername(e.target.value)
                              setTestResult(null)
                            }}
                            placeholder="optional"
                            autoComplete="off"
                            spellCheck={false}
                          />
                        </div>
                        <div className="flex flex-col gap-2">
                          <Label htmlFor="envMqttPassword">密码</Label>
                          <Input
                            id="envMqttPassword"
                            type="password"
                            value={mqttPassword}
                            onChange={(e) => {
                              setMqttPassword(e.target.value)
                              setTestResult(null)
                            }}
                            placeholder="optional"
                            autoComplete="off"
                          />
                        </div>

                        <div className="flex items-center justify-between gap-2">
                          <Button variant="outline" onClick={testMqtt} disabled={testing || !mqttUrl.trim()}>
                            {testing ? '测试中…' : '测试连接'}
                          </Button>
                          <div className="text-xs text-muted-foreground">
                            {testResult?.ok ? `已连接（${testResult.latencyMs ?? '-'}ms）` : null}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </CollapsibleContent>
                </Collapsible>
              </Card>
            ) : null}

            {envError ? (
              <Alert variant="destructive">
                <AlertTitle>保存失败</AlertTitle>
                <AlertDescription>{envError}</AlertDescription>
              </Alert>
            ) : null}

            <div className="flex items-center justify-end gap-2">
              <Button
                variant="outline"
                onClick={async () => {
                  await onRefresh()
                  await loadBrokerConfig()
                }}
                disabled={saving}
              >
                刷新
              </Button>
              <Button
                onClick={async () => {
                  // Broker save goes through saveBrokerConfig (only if changed)
                  // or directly via the sub-dialog's own save button
                  // Env save handles MQTT client config
                  await saveEnvironment()
                }}
                disabled={saving || (envMode === 'mqtt' && !mqttUrl.trim()) || (envMode === 'mqtt' && !config.mqttEnabled)}
              >
                {saving ? '保存中…' : '保存'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Broker Config Sub-Dialog ── */}
      <Dialog open={brokerConfigOpen} onOpenChange={setBrokerConfigOpen}>
        <DialogContent className="max-w-md max-h-[calc(100dvh-4rem)] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>本机 MQTT 服务设置</DialogTitle>
            <DialogDescription>修改端口和认证信息，保存后自动重启服务</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="brokerCfgPort">TCP 端口</Label>
              <Input
                id="brokerCfgPort"
                type="number"
                value={brokerPort}
                onChange={(e) => setBrokerPort(e.target.value)}
                placeholder="1883"
                min={1024}
                max={65535}
                autoComplete="off"
                spellCheck={false}
              />
              <p className="text-xs text-muted-foreground">
                客户端通过 <code className="text-xs bg-muted px-1 rounded">mqtt://localhost:{brokerPort || '1883'}</code> 连接
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="brokerCfgUsername">认证用户名（可选）</Label>
              <Input
                id="brokerCfgUsername"
                value={brokerUsername}
                onChange={(e) => setBrokerUsername(e.target.value)}
                placeholder="留空则不启用认证"
                autoComplete="off"
                spellCheck={false}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="brokerCfgPassword">认证密码（可选）</Label>
              <Input
                id="brokerCfgPassword"
                type="password"
                value={brokerPassword}
                onChange={(e) => setBrokerPassword(e.target.value)}
                placeholder="留空则不启用认证"
                autoComplete="off"
              />
            </div>
            {envError ? (
              <Alert variant="destructive">
                <AlertTitle>操作失败</AlertTitle>
                <AlertDescription>{envError}</AlertDescription>
              </Alert>
            ) : null}
            <div className="flex items-center justify-end gap-2">
              <Button variant="outline" onClick={() => { setEnvError(null); setBrokerConfigOpen(false) }} disabled={saving}>
                取消
              </Button>
              <Button onClick={saveBrokerConfig} disabled={saving}>
                {saving ? '保存中…' : '保存并重启'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Broker Clients Sub-Dialog ── */}
      <Dialog open={brokerClientsOpen} onOpenChange={setBrokerClientsOpen}>
        <DialogContent className="max-w-md max-h-[calc(100dvh-4rem)] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>已连接客户端</DialogTitle>
            <DialogDescription>
              {brokerClients.length ? `共 ${brokerClients.length} 个客户端` : '当前无客户端连接'}
            </DialogDescription>
          </DialogHeader>
          {brokerClients.length > 0 ? (
            <div className="flex flex-col gap-2">
              {brokerClients.map((c) => (
                <div key={c.id} className="flex items-center justify-between rounded-lg border px-3 py-2">
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <span className="text-sm font-mono truncate">{c.id}</span>
                    <span className="text-xs text-muted-foreground">{c.address || 'unknown'}</span>
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {new Date(c.connectedAt).toLocaleTimeString()}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">
              {brokerStatus?.running ? '暂无客户端连接' : 'MQTT 服务未运行'}
            </p>
          )}
          <div className="flex items-center justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => { loadBrokerClients() }}>
              刷新
            </Button>
            <Button variant="outline" onClick={() => setBrokerClientsOpen(false)}>
              关闭
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <div className={isMac ? 'mx-auto max-w-6xl px-6 pt-16 pb-10' : 'mx-auto max-w-6xl px-6 pt-12 pb-10'}>
        <div className="flex flex-col gap-4">
          {activeView && (
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => setActiveView(null)} className="gap-1">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
                返回
              </Button>
              <span className="text-sm font-medium text-muted-foreground">
                {activeView === 'skills' ? '技能管理' : activeView === 'debug' ? '模型调试' : activeView === 'models' ? '模型管理' : ''}
              </span>
            </div>
          )}

          {activeView === 'skills' ? (
            <SkillManagementView />
          ) : activeView === 'debug' ? (
            <ModelDebugView onGoToModels={() => setActiveView('models')} />
          ) : activeView === 'models' ? (
            <ModelManagementView onBack={() => setActiveView(null)} />
          ) : (<>
              <div className="flex items-start justify-between gap-4">
                <div className="flex min-w-0 flex-col gap-1">
                  <div className="text-sm font-medium text-muted-foreground">应用管理</div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    onClick={async () => {
                      await loadApps(true)
                    }}
                    disabled={appsLoading}
                  >
                    {appsLoading ? '刷新中…' : '刷新'}
                  </Button>
                  <Button
                    onClick={() => {
                      setEditingAppId(null)
                      setAppAlias('')
                      setAppDirectory('')
                      setAppFingerprint('')
                      setAppRemoteUrl('')
                      setImportMode('local')
                      setAppsError(null)
                      setAppsSaving(false)
                      setAppsOpen(true)
                      const active = document.activeElement
                      if (active instanceof HTMLElement) active.blur()
                    }}
                  >
                    新增应用
                  </Button>
                </div>
              </div>

              {appsError ? (
                <Alert variant="destructive">
                  <AlertTitle>操作失败</AlertTitle>
                  <AlertDescription>{appsError}</AlertDescription>
                </Alert>
              ) : null}

              {appsLoading ? (
                <div className="grid grid-cols-4 gap-x-4 gap-y-6">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="flex flex-col items-center gap-2.5">
                      <Skeleton className="w-[72px] h-[72px] rounded-[22.5%]" />
                      <Skeleton className="h-3 w-14 rounded-full" />
                    </div>
                  ))}
                </div>
              ) : apps.length ? (
                <div className="relative">
                  <div className="grid grid-cols-4 gap-x-5 gap-y-7">
                      {apps.map((a) => {
                        const displayName = a.alias || a.hsq?.appName || '未命名'
                        const initial = (displayName[0] || '?').toUpperCase()
                        const hue = (a.id || displayName).split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360

                        return (
                          <div key={a.id} className="flex flex-col items-center gap-2.5">
                            <div className="relative">
                              <button
                                onClick={async () => {
                                  const eventCenter = getEventCenter()
                                  if (!eventCenter) return
                                  setAppsError(null)

                                  // self_shop is a storefront — it doesn't need a model
                                  if (a.hsq?.appId !== 'self_shop') {
                                    try {
                                      const models = await eventCenter.listModels()
                                      if (!Array.isArray(models) || models.length === 0) {
                                        setNoModelAppId(a.id)
                                        return
                                      }
                                    } catch {
                                      // If we can't check models, let the app open anyway
                                    }
                                  }

                                  try {
                                    await eventCenter.invoke('apps', 'open', [{ id: a.id }])
                                    if (a.hsq?.appId) {
                                      setRunningApps((prev) => {
                                        if (prev.has(a.hsq.appId)) return prev
                                        const n = new Set(prev)
                                        n.add(a.hsq.appId)
                                        return n
                                      })
                                    }
                                  } catch (e: unknown) {
                                    setAppsError(getErrorMessage(e) || '启动失败')
                                  }
                                }}
                                onContextMenu={a.hsq?.appId === 'self_shop' ? undefined : (e) => {
                                  e.preventDefault()
                                  e.stopPropagation()
                                  setAppContextMenu({ appId: a.id, x: e.clientX, y: e.clientY })
                                }}
                                className="w-[72px] h-[72px] rounded-[22.5%] overflow-hidden
                                           shadow-md shadow-black/10
                                           transition-all duration-150 ease-out
                                           hover:scale-105 hover:shadow-lg hover:shadow-black/15
                                           active:scale-95 active:shadow-sm
                                           focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                              >
                              {a.iconBase64 ? (
                                <img src={a.iconBase64} alt="" className="w-full h-full object-cover" draggable={false} />
                              ) : (
                                <div
                                  className="w-full h-full flex items-center justify-center text-[28px] font-semibold text-white select-none"
                                  style={{ background: `linear-gradient(135deg, hsl(${hue}, 65%, 55%), hsl(${hue + 25}, 60%, 45%))` }}
                                >
                                  {initial}
                                </div>
                              )}
                            </button>
                            {runningApps.has(a.hsq?.appId || '') ? (
                              <span className="absolute bottom-1 right-1 size-2.5 rounded-full bg-green-500 border-2 border-background shadow-sm" title="运行中" />
                            ) : null}
                            </div>

                            <span className="text-[11px] leading-tight text-center text-foreground/75 font-medium max-w-[72px] line-clamp-2 select-none">
                              {displayName}
                            </span>
                          </div>
                        )
                      })}
                    </div>

                  {/* Context menu popover */}
                  {appContextMenu ? (() => {
                    const ctxApp = apps.find((x) => x.id === appContextMenu.appId)
                    const ctxIsPinned = ctxApp?.pinned === true
                    return (
                    <div
                      className="fixed z-50 min-w-[120px] rounded-xl border bg-popover p-1.5 shadow-xl animate-in fade-in-0 zoom-in-95"
                      style={{ left: appContextMenu.x - 60, top: appContextMenu.y - 10 }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        className="w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-accent transition-colors"
                        onClick={async () => {
                          const eid = appContextMenu.appId
                          setAppContextMenu(null)
                          try {
                            const ec = getEventCenter()
                            await ec?.pinApp?.({ id: eid, pinned: !ctxIsPinned })
                            await loadApps()
                          } catch {}
                        }}
                      >
                        {ctxIsPinned ? '取消置顶' : '置顶'}
                      </button>
                      <button
                        className="w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-accent transition-colors"
                        onClick={() => {
                          const app = apps.find((x) => x.id === appContextMenu.appId)
                          if (app) {
                            const isRemote = app?.hsq?.mode === 'remote'
                            setEditingAppId(app.id)
                            setAppAlias(app.alias || '')
                            setAppDirectory(isRemote ? '' : (app.directory || ''))
                            setAppRemoteUrl(isRemote ? (app.hsq?.remoteUrl || app.directory || '') : '')
                            setAppFingerprint('')
                            setImportMode(isRemote ? 'remote' : 'local')
                            setAppsError(null)
                            setAppsSaving(false)
                            setAppsOpen(true)
                          }
                          setAppContextMenu(null)
                        }}
                      >
                        编辑
                      </button>
                      <button
                        className="w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-destructive/10 text-destructive transition-colors"
                        onClick={() => {
                          setDeleteAppId(appContextMenu.appId)
                          setAppContextMenu(null)
                        }}
                      >
                        删除
                      </button>
                    </div>
                    )
                  })() : null}
                </div>
              ) : (
                <div className="rounded-3xl bg-muted/20 border border-dashed border-border/40 flex flex-col items-center justify-center py-16 gap-3">
                  <div className="size-16 rounded-2xl bg-muted/50 flex items-center justify-center">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="text-muted-foreground/60">
                      <rect x="3" y="3" width="7" height="7" rx="2" />
                      <rect x="14" y="3" width="7" height="7" rx="2" />
                      <rect x="3" y="14" width="7" height="7" rx="2" />
                      <rect x="14" y="14" width="7" height="7" rx="2" />
                    </svg>
                  </div>
                  <div className="text-center">
                    <div className="text-sm font-medium text-muted-foreground">暂无应用</div>
                    <div className="text-xs text-muted-foreground/60 mt-0.5">右键图标可编辑或删除</div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default App
