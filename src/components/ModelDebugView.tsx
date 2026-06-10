import { useCallback, useEffect, useRef, useState } from 'react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
} from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import {
  SendIcon,
  BotIcon,
  UserIcon,
  AlertCircleIcon,
  MessageSquareIcon,
  ChevronDownIcon,
  FolderOpenIcon,
  PaperclipIcon,
  XIcon,
  FileTextIcon,
  ImageIcon,
  EyeIcon,
  Code2Icon,
  FileIcon,
  PuzzleIcon,
  PackageIcon,
  WrenchIcon,
  CableIcon
} from 'lucide-react'
import { getEventCenter, getErrorMessage } from '@/lib/eventCenter'
import type { ManagedModelItem, AgentRunResult, ContextFile, ReadImageResult, FilePreviewResult, SkillItem, PluginPackItem, McpConfigItem } from '@/lib/eventCenter'

type ChatMessage = {
  id: string
  role: 'user' | 'assistant' | 'error'
  content: string
  timestamp: number
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function ModelDebugView({ onGoToModels }: { onGoToModels?: () => void }) {
  const [models, setModels] = useState<ManagedModelItem[]>([])
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [inputValue, setInputValue] = useState('')
  const [sending, setSending] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  // Working directory binding
  const [workingDir, setWorkingDir] = useState<string | null>(null)
  const [workdirIsDefault, setWorkdirIsDefault] = useState(false)
  const [appId, setAppId] = useState<string | null>(null)
  const [pickingDir, setPickingDir] = useState(false)

  // AppId workdir query
  const [queryAppId, setQueryAppId] = useState('')
  const [queryResult, setQueryResult] = useState<{ workdir: string; isDefault: boolean } | null>(null)
  const [queryLoading, setQueryLoading] = useState(false)
  const [queryError, setQueryError] = useState<string | null>(null)

  // Context files
  const [contextFiles, setContextFiles] = useState<ContextFile[]>([])
  const [pickingFiles, setPickingFiles] = useState(false)

  // Context images (vision)
  const [contextImages, setContextImages] = useState<ReadImageResult[]>([])
  const [pickingImages, setPickingImages] = useState(false)

  // File preview dialog
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewResult, setPreviewResult] = useState<FilePreviewResult | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)

  // --- Skills/Packs/MCP test state ---
  const [testSkills, setTestSkills] = useState<SkillItem[]>([])
  const [testPacks, setTestPacks] = useState<PluginPackItem[]>([])
  const [testMcpConfigs, setTestMcpConfigs] = useState<McpConfigItem[]>([])
  const [testLoading, setTestLoading] = useState(false)
  const [activePluginPaths, setActivePluginPaths] = useState<string[]>([])
  const [testPanelOpen, setTestPanelOpen] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  // Load models and app context on mount
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const eventCenter = getEventCenter()
      if (!eventCenter) {
        setLoading(false)
        return
      }
      setLoading(true)
      setError(null)
      try {
        const [modelList, selected, currentAppId] = await Promise.all([
          eventCenter.listModels(),
          eventCenter.getSelectedModel(),
          eventCenter.getAppId()
        ])
        if (cancelled) return
        setModels(Array.isArray(modelList) ? modelList : [])
        if (selected?.id) {
          setSelectedModelId(selected.id)
        } else if (Array.isArray(modelList) && modelList.length > 0) {
          setSelectedModelId(modelList[0].id)
        }

        // Load app workdir if running as child app
        if (currentAppId) {
          setAppId(currentAppId)
          try {
            const wr = await eventCenter.getAppWorkdir(currentAppId)
            if (!cancelled) {
              setWorkingDir(wr.workdir)
              setWorkdirIsDefault(wr.isDefault)
            }
          } catch {
            // Ignore — workdir resolution failure is non-fatal
          }
        }
      } catch (e: unknown) {
        if (cancelled) return
        setError(getErrorMessage(e) || '加载失败')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const handleModelChange = useCallback((modelId: string) => {
    if (modelId === selectedModelId) return
    setSelectedModelId(modelId)
    setSessionId(null) // Reset session on model change
    setError(null)
  }, [selectedModelId])

  const handlePickWorkingDir = useCallback(async () => {
    const eventCenter = getEventCenter()
    if (!eventCenter) return
    setPickingDir(true)
    setError(null)
    try {
      const res = await eventCenter.pickWorkingDirectory()
      if (res.directory) {
        setWorkingDir(res.directory)
        setWorkdirIsDefault(false)
        // Persist to app workdir if running as child app
        if (appId) {
          await eventCenter.setAppWorkdir({ appId, directory: res.directory })
        }
      }
    } catch (e: unknown) {
      setError(getErrorMessage(e) || '选择目录失败')
    } finally {
      setPickingDir(false)
    }
  }, [appId])

  const handlePickFiles = useCallback(async () => {
    const eventCenter = getEventCenter()
    if (!eventCenter) return
    setPickingFiles(true)
    setError(null)
    try {
      const res = await eventCenter.pickFiles({
        multi: true
      })
      if (!res.files || res.files.length === 0) return

      // Read all selected files (skip already-added)
      const existingPaths = new Set(contextFiles.map((f) => f.path))
      const newPaths = res.files.filter((p) => !existingPaths.has(p))

      const newFiles: ContextFile[] = []
      for (const filePath of newPaths) {
        try {
          const f = await eventCenter.readAbsoluteText({ path: filePath })
          newFiles.push(f)
        } catch {
          // Skip files that can't be read
        }
      }

      if (newFiles.length > 0) {
        setContextFiles((prev) => [...prev, ...newFiles])
      }
      if (newPaths.length > 0 && newFiles.length === 0) {
        setError('无法读取所选文件（可能是二进制文件）')
      }
    } catch (e: unknown) {
      setError(getErrorMessage(e) || '选择文件失败')
    } finally {
      setPickingFiles(false)
    }
  }, [contextFiles])

  const handlePickImages = useCallback(async () => {
    const eventCenter = getEventCenter()
    if (!eventCenter) return
    setPickingImages(true)
    setError(null)
    try {
      const res = await eventCenter.pickFiles({
        multi: true,
        filters: [
          { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'svg'] }
        ]
      })
      if (!res.files || res.files.length === 0) return

      const existingPaths = new Set(contextImages.map((f) => f.path))
      const newPaths = res.files.filter((p) => !existingPaths.has(p))

      const newImages: ReadImageResult[] = []
      for (const filePath of newPaths) {
        try {
          const img = await eventCenter.readImageAsBase64({
            path: filePath,
            maxWidth: 2048,
            maxHeight: 2048,
            quality: 0.85
          })
          newImages.push(img)
        } catch {
          // Skip unsupported files
        }
      }

      if (newImages.length > 0) {
        setContextImages((prev) => [...prev, ...newImages])
      }
      if (newPaths.length > 0 && newImages.length === 0) {
        setError('无法读取所选图片（可能格式不支持或文件过大）')
      }
    } catch (e: unknown) {
      setError(getErrorMessage(e) || '选择图片失败')
    } finally {
      setPickingImages(false)
    }
  }, [contextImages])

  const handleRemoveContextImage = useCallback((filePath: string) => {
    setContextImages((prev) => prev.filter((f) => f.path !== filePath))
  }, [])

  const handleRemoveContextFile = useCallback((filePath: string) => {
    setContextFiles((prev) => prev.filter((f) => f.path !== filePath))
  }, [])

  const handleClearWorkingDir = useCallback(async () => {
    if (appId) {
      // Child app: reset to default workdir
      const eventCenter = getEventCenter()
      if (!eventCenter) return
      try {
        // Remove persisted custom workdir by setting empty (backend will use default)
        await eventCenter.setAppWorkdir({ appId, directory: '' })
        const wr = await eventCenter.getAppWorkdir(appId)
        setWorkingDir(wr.workdir)
        setWorkdirIsDefault(true)
      } catch {
        setWorkingDir(null)
      }
    } else {
      // Main app: just clear local state
      setWorkingDir(null)
    }
  }, [appId])

  const handleQueryWorkdir = useCallback(async () => {
    const id = queryAppId.trim()
    if (!id) return
    const eventCenter = getEventCenter()
    if (!eventCenter) return
    setQueryLoading(true)
    setQueryError(null)
    setQueryResult(null)
    try {
      const wr = await eventCenter.getAppWorkdir(id)
      setQueryResult(wr)
    } catch (e: unknown) {
      setQueryError(getErrorMessage(e) || '查询失败')
    } finally {
      setQueryLoading(false)
    }
  }, [queryAppId])

  const handleSend = useCallback(async () => {
    const prompt = inputValue.trim()
    if (!prompt || sending) return

    const eventCenter = getEventCenter()
    if (!eventCenter) {
      setError('未检测到 Electron eventCenter')
      return
    }

    if (!selectedModelId) {
      setError('请先选择模型')
      return
    }

    // Build full prompt: attach file contexts if any
    let fullPrompt = prompt
    if (contextFiles.length > 0) {
      const fileContexts = contextFiles
        .map(
          (f) =>
            `\n--- FILE: ${f.name} (${f.path}, ${formatFileSize(f.size)}) ---\n${f.content}\n--- END FILE: ${f.name} ---`
        )
        .join('\n')
      fullPrompt = `[CONTEXT FILES]\n${fileContexts}\n\n[USER MESSAGE]\n${prompt}`
    }

    // Build display preview
    const attachments: string[] = []
    if (contextFiles.length > 0) attachments.push(`📎 ${contextFiles.map((f) => f.name).join(', ')}`)
    if (contextImages.length > 0) attachments.push(`🖼 ${contextImages.length} 张图片`)

    const displayContent = attachments.length > 0
      ? `${attachments.join('  ')}\n\n${prompt}`
      : prompt

    const msgId = `msg_${Date.now()}_${Math.random().toString(16).slice(2)}`
    const userMsg: ChatMessage = {
      id: msgId,
      role: 'user',
      content: displayContent,
      timestamp: Date.now()
    }

    setMessages((prev) => [...prev, userMsg])
    setInputValue('')
    setSending(true)
    setError(null)

    try {
      const imagesForAgent = contextImages.length > 0
        ? contextImages.map((img) => ({ base64: img.base64, detail: 'high' as const }))
        : undefined

      const pluginsForAgent = activePluginPaths.length > 0
        ? activePluginPaths.map(p => ({ type: 'local' as const, path: p }))
        : undefined
      console.log('pluginsForAgent', pluginsForAgent)

      const result = (await eventCenter.runAgentWithModel({
        agentName: 'claude',
        prompt: fullPrompt,
        sessionId: sessionId || undefined,
        modelId: selectedModelId,
        cwd: workingDir || undefined,
        allowTools: true,
        permissionMode: 'bypassPermissions',
        collectMessages: false,
        images: imagesForAgent,
        plugins: pluginsForAgent
      })) as AgentRunResult

      const assistantMsg: ChatMessage = {
        id: `msg_${Date.now()}_${Math.random().toString(16).slice(2)}`,
        role: result.ok ? 'assistant' : 'error',
        content: result.ok
          ? (result.result || '（无响应内容）')
          : `Agent 执行出错${result.stopReason ? `：${result.stopReason}` : ''}`,
        timestamp: Date.now()
      }

      setMessages((prev) => [...prev, assistantMsg])
      if (result.sessionId) {
        setSessionId(result.sessionId)
      }
    } catch (e: unknown) {
      const errorMsg: ChatMessage = {
        id: `msg_${Date.now()}_${Math.random().toString(16).slice(2)}`,
        role: 'error',
        content: getErrorMessage(e) || '调用 Agent 失败',
        timestamp: Date.now()
      }
      setMessages((prev) => [...prev, errorMsg])
      setError(getErrorMessage(e) || '调用 Agent 失败')
    } finally {
      setSending(false)
      setTimeout(() => {
        inputRef.current?.focus()
      }, 100)
    }
  }, [inputValue, sending, selectedModelId, sessionId, workingDir, contextFiles, contextImages, activePluginPaths])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSend()
      }
    },
    [handleSend]
  )

  const handlePreview = useCallback(async (filePath: string) => {
    const eventCenter = getEventCenter()
    if (!eventCenter) return
    setPreviewResult(null)
    setPreviewError(null)
    setPreviewLoading(true)
    try {
      const res = await eventCenter.previewFile({ path: filePath, maxTextBytes: 256 * 1024, maxImageDim: 1400 })
      if (res.type === 'binary') {
        // Unsupported file type: open a standalone preview window
        setPreviewLoading(false)
        try { await eventCenter.previewFileDialog({ filePath }) } catch { /* ignore */ }
        return
      }
      setPreviewResult(res)
      setPreviewOpen(true)
    } catch (e: unknown) {
      setPreviewError(getErrorMessage(e) || '预览失败')
      setPreviewOpen(true)
    } finally {
      setPreviewLoading(false)
    }
  }, [])

  const handleOpenInFolder = useCallback(async (filePath: string) => {
    const eventCenter = getEventCenter()
    if (!eventCenter) return
    try {
      await eventCenter.showItemInFolder({ path: filePath })
    } catch { /* ignore */ }
  }, [])

  const handleClearSession = useCallback(() => {
    setSessionId(null)
    setMessages([])
    setError(null)
    setContextImages([])
  }, [])

  const loadTestData = useCallback(async () => {
    const ec = getEventCenter()
    if (!ec) return
    setTestLoading(true)
    try {
      const [skills, packs, mcpConfigsData] = await Promise.all([
        ec.listSkills({}) as Promise<SkillItem[]>,
        ec.listPluginPacks() as Promise<PluginPackItem[]>,
        ec.listMcpConfigs({}) as Promise<McpConfigItem[]>
      ])
      setTestSkills(Array.isArray(skills) ? skills : [])
      setTestPacks(Array.isArray(packs) ? packs : [])
      setTestMcpConfigs(Array.isArray(mcpConfigsData) ? mcpConfigsData : [])
    } catch { /* ignore */ }
    finally { setTestLoading(false) }
  }, [])

  useEffect(() => {
    if (testPanelOpen) { void loadTestData() }
  }, [testPanelOpen, loadTestData])

  const togglePluginPath = useCallback(async (path: string) => {
    setActivePluginPaths(prev =>
      prev.includes(path) ? prev.filter(p => p !== path) : [...prev, path]
    )
  }, [])

  const selectedModel = models.find((m) => m.id === selectedModelId)

  // Loading state
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-4 w-48" />
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        </CardContent>
      </Card>
    )
  }

  // Empty state: no models configured
  if (models.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">模型调试</CardTitle>
          <CardDescription>选择模型进行对话测试</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center gap-4 py-8 text-center">
            <MessageSquareIcon className="size-8 text-muted-foreground" />
            <div>
              <div className="text-sm font-medium">暂无可用模型</div>
              <div className="text-sm text-muted-foreground mt-1">
                请先在模型管理中配置模型
              </div>
            </div>
            {onGoToModels ? (
              <Button variant="outline" onClick={onGoToModels}>
                前往模型管理
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="flex flex-col h-[calc(100dvh-16rem)] min-h-[500px]">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 flex-col gap-1">
            <CardTitle className="text-base">模型调试</CardTitle>
            <CardDescription>
              选择模型进行对话测试{sessionId ? ' · 会话中' : ''}
            </CardDescription>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {sessionId ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearSession}
                title="清除会话（新建对话）"
              >
                新对话
              </Button>
            ) : null}
            {/* Working Directory Button */}
            <Button
              variant={workingDir ? (workdirIsDefault ? 'outline' : 'default') : 'outline'}
              size="sm"
              onClick={handlePickWorkingDir}
              disabled={pickingDir}
              title={workingDir || '绑定运行目录'}
            >
              <FolderOpenIcon className="size-3.5 mr-1" />
              {workingDir
                ? workingDir.split('/').pop() || workingDir.split('\\').pop() || '...'
                : '目录'}
            </Button>

            {/* File Picker Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={handlePickFiles}
              disabled={pickingFiles}
              title="选择文件添加到上下文"
            >
              <PaperclipIcon className="size-3.5 mr-1" />
              文件
            </Button>

            {/* Image Picker Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={handlePickImages}
              disabled={pickingImages}
              title="选择图片添加到上下文（vision）"
            >
              <ImageIcon className="size-3.5 mr-1" />
              图片
            </Button>

            {/* Model Selector */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5">
                  {selectedModel ? selectedModel.alias : '选择模型'}
                  <ChevronDownIcon className="size-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {models.map((m) => (
                  <DropdownMenuItem
                    key={m.id}
                    onSelect={() => handleModelChange(m.id)}
                  >
                    <div className="flex flex-col gap-0.5">
                      <span>{m.alias}</span>
                      <span className="text-xs text-muted-foreground">{m.name}</span>
                    </div>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Working Directory + Context Files info bar */}
        {(workingDir || contextFiles.length > 0 || contextImages.length > 0) ? (
          <div className="flex flex-col gap-1.5 pt-2">
            {workingDir ? (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <FolderOpenIcon className="size-3 shrink-0" />
                <span className="truncate" title={workingDir}>
                  {appId ? (workdirIsDefault ? '默认工作目录: ' : '工作目录: ') : ''}
                  {workingDir}
                </span>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="size-4 shrink-0 ml-1"
                  onClick={handleClearWorkingDir}
                  title="取消绑定目录"
                >
                  <XIcon className="size-3" />
                </Button>
              </div>
            ) : null}
            {contextFiles.length > 0 ? (
              <div className="flex flex-wrap items-center gap-1">
                {contextFiles.map((f) => (
                  <span
                    key={f.path}
                    className="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-xs"
                    title={`${f.path} (${formatFileSize(f.size)})`}
                  >
                    <FileTextIcon className="size-3" />
                    <span className="max-w-[100px] truncate cursor-pointer hover:underline" onClick={() => handlePreview(f.path)} title="点击预览">{f.name}</span>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="size-4 shrink-0 hover:text-primary"
                      onClick={() => handlePreview(f.path)}
                      title="预览"
                    >
                      <EyeIcon className="size-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="size-4 shrink-0"
                      onClick={() => handleRemoveContextFile(f.path)}
                      title="移除"
                    >
                      <XIcon className="size-3" />
                    </Button>
                  </span>
                ))}
              </div>
            ) : null}
            {contextImages.length > 0 ? (
              <div className="flex flex-wrap items-center gap-1">
                {contextImages.map((img) => (
                  <span
                    key={img.path}
                    className="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-xs"
                    title={`${img.path} (${img.width}x${img.height}, ${formatFileSize(img.sizeBytes)})`}
                  >
                    <ImageIcon className="size-3" />
                    <span className="max-w-[70px] truncate cursor-pointer hover:underline" onClick={() => handlePreview(img.path)} title="点击预览">
                      {img.path.split('/').pop() || img.path.split('\\').pop() || 'image'}
                    </span>
                    <span className="text-muted-foreground">{img.width}x{img.height}</span>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="size-4 shrink-0 hover:text-primary"
                      onClick={() => handlePreview(img.path)}
                      title="预览"
                    >
                      <EyeIcon className="size-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="size-4 shrink-0"
                      onClick={() => handleRemoveContextImage(img.path)}
                      title="移除图片"
                    >
                      <XIcon className="size-3" />
                    </Button>
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </CardHeader>

      <Separator className="shrink-0" />

      {/* AppId Workdir Query */}
      <div className="shrink-0 px-4 py-2 border-b bg-muted/30">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground shrink-0">appId:</span>
          <input
            type="text"
            value={queryAppId}
            onChange={(e) => {
              setQueryAppId(e.target.value)
              if (queryError) setQueryError(null)
            }}
            onKeyDown={(e) => { if (e.key === 'Enter') handleQueryWorkdir() }}
            placeholder={appId || '输入 appId 查询工作目录'}
            className="flex-1 h-7 rounded border border-input bg-background px-2 text-xs shadow-sm placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={handleQueryWorkdir}
            disabled={queryLoading || !queryAppId.trim()}
          >
            {queryLoading ? '查询中…' : '查询'}
          </Button>
          {queryResult ? (
            <div className="flex items-center gap-1.5 text-xs min-w-0">
              <FolderOpenIcon className="size-3 shrink-0 text-muted-foreground" />
              <span className="truncate text-muted-foreground" title={queryResult.workdir}>
                {queryResult.workdir}
              </span>
              <span className={`shrink-0 px-1 py-0.5 rounded text-[10px] ${queryResult.isDefault ? 'bg-muted text-muted-foreground' : 'bg-primary/10 text-primary'}`}>
                {queryResult.isDefault ? '默认' : '自定义'}
              </span>
            </div>
          ) : queryError ? (
            <span className="text-xs text-destructive shrink-0">{queryError}</span>
          ) : null}
        </div>
      </div>

      {/* Chat Messages Area */}
      <CardContent className="flex-1 overflow-y-auto py-4 min-h-0">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center gap-3 py-8">
            <BotIcon className="size-8 text-muted-foreground" />
            <div>
              <div className="text-sm font-medium">开始对话</div>
              <div className="text-sm text-muted-foreground mt-1">
                输入消息发送给 {selectedModel?.alias || '选中的模型'}
              </div>
              {!workingDir && contextFiles.length === 0 ? (
                <div className="text-xs text-muted-foreground/70 mt-2">
                {appId
                  ? `默认工作目录: ${workingDir || '加载中...'}`
                  : '可绑定运行目录或添加文件作为上下文'}
              </div>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.role !== 'user' ? (
                  <div className="shrink-0 mt-1">
                    {msg.role === 'error' ? (
                      <AlertCircleIcon className="size-4 text-destructive" />
                    ) : (
                      <BotIcon className="size-4 text-muted-foreground" />
                    )}
                  </div>
                ) : null}
                <div
                  className={`max-w-[80%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap break-words ${
                    msg.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : msg.role === 'error'
                        ? 'bg-destructive/10 text-destructive border border-destructive/20'
                        : 'bg-muted text-foreground'
                  }`}
                >
                  {msg.content}
                </div>
                {msg.role === 'user' ? (
                  <div className="shrink-0 mt-1">
                    <UserIcon className="size-4 text-muted-foreground" />
                  </div>
                ) : null}
              </div>
            ))}

            {/* Sending indicator */}
            {sending ? (
              <div className="flex gap-2 justify-start">
                <div className="shrink-0 mt-1">
                  <BotIcon className="size-4 text-muted-foreground" />
                </div>
                <div className="bg-muted rounded-lg px-3 py-3 flex items-center gap-1.5">
                  <span className="inline-block size-1.5 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:0ms]" />
                  <span className="inline-block size-1.5 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:150ms]" />
                  <span className="inline-block size-1.5 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:300ms]" />
                </div>
              </div>
            ) : null}

            <div ref={messagesEndRef} />
          </div>
        )}
      </CardContent>

      {/* Input Area */}
      <CardFooter className="pt-0 flex-col gap-2">
        {error ? (
          <Alert variant="destructive" className="w-full">
            <AlertCircleIcon className="size-4" />
            <AlertTitle className="text-sm">错误</AlertTitle>
            <AlertDescription className="text-xs">{error}</AlertDescription>
          </Alert>
        ) : null}

        <div className="flex items-center gap-2 w-full">
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => {
              setInputValue(e.target.value)
              if (error) setError(null)
            }}
            onKeyDown={handleKeyDown}
            placeholder={sending ? '等待回复中…' : '输入消息，按 Enter 发送'}
            disabled={sending}
            className="flex-1 h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          />
          <Button
            size="sm"
            onClick={handleSend}
            disabled={sending || !inputValue.trim()}
          >
            <SendIcon className="size-4" />
          </Button>
        </div>
      </CardFooter>

      {/* File Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-4xl max-h-[calc(100dvh-4rem)] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              {previewResult?.type === 'image'
                ? <ImageIcon className="size-4" />
                : previewResult?.type === 'text'
                  ? <Code2Icon className="size-4" />
                  : <FileIcon className="size-4" />
              }
              {previewResult?.name || '文件预览'}
            </DialogTitle>
          </DialogHeader>

          {previewLoading ? (
            <div className="flex flex-col gap-2 py-4">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-60 w-full" />
            </div>
          ) : previewError ? (
            <div className="flex flex-col gap-3">
              <Alert variant="destructive">
                <AlertCircleIcon className="size-4" />
                <AlertTitle>预览失败</AlertTitle>
                <AlertDescription>{previewError}</AlertDescription>
              </Alert>
              <Button
                variant="outline"
                size="sm"
                className="self-end"
                onClick={() => { if (previewResult?.path) handleOpenInFolder(previewResult.path) }}
              >
                <FolderOpenIcon className="size-3.5 mr-1" />
                打开文件目录
              </Button>
            </div>
          ) : previewResult ? (
            <div className="flex flex-col gap-2">
              {/* Meta info */}
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span>{previewResult.type === 'image' ? '图片' : previewResult.type === 'text' ? '文本' : '二进制'}</span>
                <span>·</span>
                <span>{formatFileSize(previewResult.sizeBytes)}</span>
                {previewResult.type === 'image' && previewResult.width ? (
                  <>
                    <span>·</span>
                    <span>{previewResult.width}×{previewResult.height}</span>
                    <span>·</span>
                    <span>{previewResult.mimeType}</span>
                  </>
                ) : null}
                {previewResult.type === 'text' && previewResult.language ? (
                  <>
                    <span>·</span>
                    <span>{previewResult.language}</span>
                    {previewResult.truncated ? <span className="text-amber-500">（内容已截断）</span> : null}
                  </>
                ) : null}
              </div>

              {/* Content */}
              {previewResult.type === 'image' && previewResult.base64 ? (
                <div className="flex items-center justify-center rounded-md border bg-muted/20 p-4">
                  <img
                    src={previewResult.base64}
                    alt={previewResult.name}
                    className="max-h-[60dvh] rounded object-contain"
                  />
                </div>
              ) : previewResult.type === 'text' && previewResult.content ? (
                <pre className="overflow-auto rounded-md border bg-muted/30 p-4 text-sm leading-relaxed whitespace-pre-wrap break-all max-h-[60dvh]">
                  <code>{previewResult.content}</code>
                </pre>
              ) : null}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* ====== Skills/Packs Test Panel ====== */}
      <Separator className="shrink-0" />

      <CardFooter className="flex-col gap-3 pt-3">
        <button
          onClick={() => { setTestPanelOpen(v => !v); if (!testPanelOpen) setActivePluginPaths([]) }}
          className="flex items-center gap-2 w-full text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <WrenchIcon className="size-4" />
          技能 / MCP / 插件包测试
          <span className="text-xs text-muted-foreground/60 ml-auto">
            {activePluginPaths.length > 0 ? `${activePluginPaths.length} 个插件已激活` : '未激活插件'}
          </span>
        </button>

        {testPanelOpen ? (
          <div className="w-full flex flex-col gap-3">
            {/* Active plugins indicator */}
            {activePluginPaths.length > 0 ? (
              <div className="flex flex-wrap items-center gap-1.5 rounded-lg bg-primary/5 border border-primary/20 px-3 py-2">
                <span className="text-xs font-medium text-primary shrink-0">已激活插件：</span>
                {activePluginPaths.map((p) => (
                  <span key={p} className="inline-flex items-center gap-1 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary truncate max-w-[200px]" title={p}>
                    {p.split('/').pop() || p.split('\\').pop() || p}
                    <button onClick={() => togglePluginPath(p)} className="hover:text-destructive shrink-0">×</button>
                  </span>
                ))}
              </div>
            ) : (
              <div className="text-xs text-muted-foreground/60 text-center py-1">
                选择技能、MCP 配置或插件包添加到下方对话中
              </div>
            )}

            {testLoading ? (
              <div className="flex gap-2">
                <Skeleton className="h-16 flex-1" />
                <Skeleton className="h-16 flex-1" />
              </div>
            ) : (
              <>
                {/* Skills */}
                <div className="flex flex-col gap-1">
                  <div className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                    <PuzzleIcon className="size-3" />
                    技能 ({testSkills.length})
                  </div>
                  {testSkills.length === 0 ? (
                    <p className="text-xs text-muted-foreground/50 pl-1">暂无技能，请先在「技能管理」中上传</p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {testSkills.map((s) => {
                        const active = activePluginPaths.includes(s.directory)
                        return (
                          <button
                            key={s.id}
                            onClick={async () => {
                              const ec = getEventCenter()
                              if (!ec) return
                              const { path } = await ec.getSkillPluginPath(s.id) as { path: string }
                              togglePluginPath(path)
                            }}
                            className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs transition-colors border
                              ${active
                                ? 'bg-primary/10 border-primary/40 text-primary'
                                : 'bg-background border-border hover:bg-accent hover:border-accent-foreground/20'}`}
                          >
                            <span className="truncate max-w-[120px]">{s.name}</span>
                            <span className={`text-[9px] px-1 rounded-full shrink-0 ${s.scope === 'shared' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>
                              {s.scope === 'shared' ? '共享' : '专属'}
                            </span>
                            <span className="shrink-0">{active ? '✓' : '+'}</span>
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>

                {/* MCP Configs */}
                <div className="flex flex-col gap-1">
                  <div className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                    <CableIcon className="size-3" />
                    MCP ({testMcpConfigs.length})
                  </div>
                  {testMcpConfigs.length === 0 ? (
                    <p className="text-xs text-muted-foreground/50 pl-1">暂无 MCP 配置，请先在「MCP管理」中创建</p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {testMcpConfigs.map((cfg) => {
                        const active = activePluginPaths.includes(cfg.directory)
                        const serverCount = (() => {
                          const servers = (cfg.config as Record<string, unknown>)?.mcpServers
                          if (servers && typeof servers === 'object') return Object.keys(servers).length
                          return Object.keys(cfg.config).length
                        })()
                        return (
                          <button
                            key={cfg.id}
                            onClick={() => togglePluginPath(cfg.directory)}
                            className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs transition-colors border
                              ${active
                                ? 'bg-primary/10 border-primary/40 text-primary'
                                : 'bg-background border-border hover:bg-accent hover:border-accent-foreground/20'}`}
                            title={cfg.description || cfg.name}
                          >
                            <span className="truncate max-w-[120px]">{cfg.name}</span>
                            <span className="text-[9px] text-muted-foreground shrink-0">{serverCount}服务</span>
                            <span className="shrink-0">{active ? '✓' : '+'}</span>
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>

                {/* Plugin Packs */}
                <div className="flex flex-col gap-1">
                  <div className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                    <PackageIcon className="size-3" />
                    插件包 ({testPacks.length})
                  </div>
                  {testPacks.length === 0 ? (
                    <p className="text-xs text-muted-foreground/50 pl-1">暂无插件包，请先在「技能管理」中创建</p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {testPacks.map((p) => {
                        const active = activePluginPaths.includes(p.directory)
                        return (
                          <button
                            key={p.id}
                            onClick={async () => {
                              const ec = getEventCenter()
                              if (!ec) return
                              const { path } = await ec.getPackPluginPath(p.id) as { path: string }
                              togglePluginPath(path)
                            }}
                            className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs transition-colors border
                              ${active
                                ? 'bg-primary/10 border-primary/40 text-primary'
                                : 'bg-background border-border hover:bg-accent hover:border-accent-foreground/20'}`}
                          >
                            <span className="truncate max-w-[120px]">{p.name}</span>
                            <span className="text-[9px] text-muted-foreground shrink-0">{p.skillIds.length}技能{p.hasMcp ? '+MCP' : ''}</span>
                            <span className="shrink-0">{active ? '✓' : '+'}</span>
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        ) : null}
      </CardFooter>
    </Card>
  )
}
