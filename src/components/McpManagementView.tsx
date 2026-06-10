import { useCallback, useEffect, useState } from 'react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { AlertCircleIcon, CableIcon, PencilIcon, TrashIcon, UploadIcon, FileTextIcon, CopyIcon } from 'lucide-react'
import { getEventCenter, getErrorMessage } from '@/lib/eventCenter'
import type { McpConfigItem } from '@/lib/eventCenter'

const MCP_TEMPLATE = `{
  "mcpServers": {
    "my-server": {
      "command": "node",
      "args": ["path/to/server.js"]
    }
  }
}`

export function McpManagementView() {
  const [configs, setConfigs] = useState<McpConfigItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [scopeFilter, setScopeFilter] = useState<'all' | 'shared' | 'app'>('all')

  // Create/Edit dialog state
  const [editOpen, setEditOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [mcpName, setMcpName] = useState('')
  const [mcpDesc, setMcpDesc] = useState('')
  const [mcpConfigText, setMcpConfigText] = useState('')
  const [mcpConfigError, setMcpConfigError] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [inputMode, setInputMode] = useState<'manual' | 'upload'>('manual')
  const [uploaded, setUploaded] = useState(false)

  // Delete state
  const [deleteId, setDeleteId] = useState<string | null>(null)

  // Detail state
  const [detailItem, setDetailItem] = useState<McpConfigItem | null>(null)

  const loadConfigs = useCallback(async () => {
    const ec = getEventCenter()
    if (!ec) return
    setLoading(true)
    try {
      const res = await ec.listMcpConfigs({}) as McpConfigItem[]
      setConfigs(Array.isArray(res) ? res : [])
    } catch (e) {
      setError(getErrorMessage(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadConfigs()
  }, [loadConfigs])

  const resetForm = () => {
    setEditingId(null)
    setMcpName('')
    setMcpDesc('')
    setMcpConfigText('')
    setMcpConfigError('')
    setSaveError(null)
    setInputMode('manual')
    setUploaded(false)
  }

  const handleCreate = () => {
    resetForm()
    setMcpConfigText(MCP_TEMPLATE)
    setEditOpen(true)
  }

  const handleEdit = (item: McpConfigItem) => {
    setEditingId(item.id)
    setMcpName(item.name)
    setMcpDesc(item.description || '')
    setMcpConfigText(JSON.stringify(item.config, null, 2))
    setMcpConfigError('')
    setSaveError(null)
    setInputMode('manual')
    setUploaded(true)
    setEditOpen(true)
  }

  const handleUploadFile = async () => {
    const ec = getEventCenter()
    if (!ec) return
    try {
      const res = await ec.pickFiles({
        filters: [{ name: 'JSON Files', extensions: ['json'] }],
        multi: false
      })
      const files = (res as { files: string[] }).files
      if (!files || files.length === 0) return

      const fileRes = await ec.readAbsoluteText({ path: files[0] })
      if (!fileRes.content) {
        setMcpConfigError('文件内容为空')
        return
      }
      // Validate JSON
      try {
        const parsed = JSON.parse(fileRes.content)
        setMcpConfigText(JSON.stringify(parsed, null, 2))
        setMcpConfigError('')
        setUploaded(true)
        // Auto-fill name from filename if empty
        if (!mcpName.trim()) {
          const fileName = fileRes.name.replace(/\.json$/i, '')
          setMcpName(fileName)
        }
      } catch {
        setMcpConfigError('文件不是有效的 JSON 格式')
      }
    } catch (e) {
      setMcpConfigError(getErrorMessage(e))
    }
  }

  const handleSave = async () => {
    const ec = getEventCenter()
    if (!ec) return

    // Validate name
    if (!mcpName.trim()) {
      setSaveError('名称不能为空')
      return
    }

    // Validate config JSON
    let config: object
    try {
      config = JSON.parse(mcpConfigText)
      if (!config || typeof config !== 'object' || Object.keys(config).length === 0) {
        setMcpConfigError('配置不能为空对象')
        return
      }
      setMcpConfigError('')
    } catch {
      setMcpConfigError('配置 JSON 格式无效')
      return
    }

    setSaving(true)
    setSaveError(null)
    try {
      if (editingId) {
        await ec.updateMcpConfig({ id: editingId, name: mcpName.trim(), description: mcpDesc.trim(), config })
      } else {
        await ec.createMcpConfig({ name: mcpName.trim(), description: mcpDesc.trim(), config })
      }
      setEditOpen(false)
      resetForm()
      await loadConfigs()
    } catch (e) {
      setSaveError(getErrorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    const ec = getEventCenter()
    if (!ec) return
    try {
      await ec.deleteMcpConfig({ id })
      if (detailItem?.id === id) setDetailItem(null)
      await loadConfigs()
    } catch (e) {
      setError(getErrorMessage(e))
    } finally {
      setDeleteId(null)
    }
  }

  const configKeyCount = (config: object) => {
    if (!config) return 0
    const mcpServers = (config as Record<string, unknown>)?.mcpServers
    if (mcpServers && typeof mcpServers === 'object') {
      return Object.keys(mcpServers).length
    }
    return Object.keys(config).length
  }

  const scopeLabel = (s: string) => {
    if (s === 'shared') return '共享'
    return '专属'
  }

  const scopeBadgeClass = (s: string) => {
    if (s === 'shared') return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
    return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
  }

  return (
    <div className="flex flex-col gap-4 flex-1 min-h-0">
      {/* Header actions */}
      <div className="flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2">
          <Button onClick={handleCreate}>
            创建MCP配置
          </Button>
          <Button variant="outline" onClick={loadConfigs} disabled={loading}>
            {loading ? '刷新中…' : '刷新'}
          </Button>
        </div>
        <ToggleGroup
          type="single"
          value={scopeFilter}
          onValueChange={(v) => { if (v === 'all' || v === 'shared' || v === 'app') setScopeFilter(v) }}
          size="sm"
        >
          <ToggleGroupItem value="all" className="px-3 text-xs">全部</ToggleGroupItem>
          <ToggleGroupItem value="shared" className="px-3 text-xs">共享</ToggleGroupItem>
          <ToggleGroupItem value="app" className="px-3 text-xs">专属</ToggleGroupItem>
        </ToggleGroup>
      </div>

      <div className="overflow-y-auto flex-1 min-h-0">
        {error ? (
          <Alert variant="destructive">
            <AlertCircleIcon className="size-4" />
            <AlertTitle>加载失败</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        {/* Configs grid */}
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Card key={i} className="border">
                <CardHeader className="p-3 pb-1.5">
                  <Skeleton className="h-3.5 w-20" />
                  <Skeleton className="h-3 w-32" />
                </CardHeader>
                <CardContent className="p-3 pt-0">
                  <Skeleton className="h-4 w-14 rounded-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (() => {
          const filtered = configs.filter(item => {
            if (scopeFilter === 'shared') return item.scope === 'shared'
            if (scopeFilter === 'app') return item.scope !== 'shared'
            return true
          })
          if (filtered.length === 0) {
            const hasAny = configs.length > 0
            return (
              <div className="rounded-3xl bg-muted/20 border border-dashed border-border/40 flex flex-col items-center justify-center py-16 gap-3">
                <div className="size-16 rounded-2xl bg-muted/50 flex items-center justify-center">
                  <CableIcon className="size-7 text-muted-foreground/60" />
                </div>
                <div className="text-center">
                  <div className="text-sm font-medium text-muted-foreground">
                    {hasAny ? '该分类下暂无MCP配置' : '暂无MCP配置'}
                  </div>
                  {!hasAny ? (
                    <div className="text-xs text-muted-foreground/60 mt-0.5">创建 MCP 配置文件，可在插件包中引用</div>
                  ) : null}
                </div>
              </div>
            )
          }
          return (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {filtered.map((item) => {
              const hue = (item.id || item.name).split('').reduce((acc: number, c: string) => acc + c.charCodeAt(0), 0) % 360
              const serverCount = configKeyCount(item.config)
              return (
                <Card
                  key={item.id}
                  className="group cursor-pointer transition-all duration-200 border hover:shadow-md hover:border-primary/30"
                  onClick={() => setDetailItem(item)}
                >
                  <CardHeader className="p-3 pb-1.5">
                    <div className="flex items-start gap-2">
                      <div
                        className="shrink-0 size-8 rounded-lg flex items-center justify-center"
                        style={{ background: `linear-gradient(135deg, hsl(${hue}, 55%, 50%), hsl(${hue + 30}, 50%, 40%))` }}
                      >
                        <CableIcon className="size-4 text-white" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1">
                          <CardTitle className="text-xs truncate">{item.name}</CardTitle>
                          <span className={`shrink-0 px-1 py-0.5 text-[8px] font-medium rounded ${scopeBadgeClass(item.scope)}`} title={item.scope !== 'shared' ? item.scope : undefined}>
                            {scopeLabel(item.scope)}
                          </span>
                        </div>
                        {item.description ? (
                          <CardDescription className="text-[10px] mt-0.5 line-clamp-2">{item.description}</CardDescription>
                        ) : (
                          <CardDescription className="text-[10px] mt-0.5 text-muted-foreground/60">
                            {serverCount > 0 ? `${serverCount} 个 MCP 服务` : `${Object.keys(item.config).length} 个配置项`}
                          </CardDescription>
                        )}
                        <span className="inline-block mt-1 px-1.5 py-0.5 text-[8px] font-medium rounded bg-violet-100 text-violet-700 dark:bg-violet-900/20 dark:text-violet-400">
                          可独立作为 Claude 插件使用
                        </span>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="p-3 pt-0">
                    <div className="flex items-center justify-between text-[9px] text-muted-foreground/50">
                      <span>{new Date(item.updatedAt).toLocaleDateString('zh-CN')}</span>
                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="icon-sm" className="size-4.5" onClick={async () => {
                                const ec = getEventCenter()
                                if (!ec || !item.directory) return
                                await navigator.clipboard.writeText(item.directory).catch(() => {})
                              }}>
                                <CopyIcon className="size-2.5" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>复制插件路径</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="icon-sm" className="size-4.5" onClick={() => handleEdit(item)}>
                                <PencilIcon className="size-2.5" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>编辑</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="icon-sm" className="size-4.5" onClick={() => setDeleteId(item.id)}>
                                <TrashIcon className="size-2.5 text-destructive" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>删除</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
          )
          })()}
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={(o) => { setEditOpen(o); if (!o) resetForm() }}>
        <DialogContent className="max-w-lg max-h-[calc(100dvh-4rem)] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? '编辑MCP配置' : '创建MCP配置'}</DialogTitle>
            <DialogDescription>配置 MCP 服务连接信息，可在插件包中引用</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            {/* Name */}
            <div className="flex flex-col gap-2">
              <Label htmlFor="mcpName">名称 *</Label>
              <Input
                id="mcpName"
                value={mcpName}
                onChange={(e) => setMcpName(e.target.value)}
                placeholder="例如：我的文件系统服务"
              />
            </div>
            {/* Description */}
            <div className="flex flex-col gap-2">
              <Label htmlFor="mcpDesc">描述</Label>
              <Input
                id="mcpDesc"
                value={mcpDesc}
                onChange={(e) => setMcpDesc(e.target.value)}
                placeholder="简要说明该 MCP 配置的用途"
              />
            </div>

            {/* Input mode switcher */}
            <div className="flex flex-col gap-2">
              <Label>配置方式</Label>
              <div className="flex gap-2">
                <Button
                  variant={inputMode === 'manual' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setInputMode('manual')}
                  className="gap-1.5 flex-1"
                >
                  <FileTextIcon className="size-3.5" />
                  手动编写
                </Button>
                <Button
                  variant={inputMode === 'upload' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setInputMode('upload')}
                  className="gap-1.5 flex-1"
                >
                  <UploadIcon className="size-3.5" />
                  上传配置
                </Button>
              </div>
            </div>

            {/* Config input */}
            <div className="flex flex-col gap-2">
              <Label>
                {inputMode === 'upload' && !uploaded ? '上传配置文件' : 'MCP 配置（JSON）'}
              </Label>
              {inputMode === 'upload' && !uploaded ? (
                <div className="flex flex-col gap-2">
                  <Button
                    variant="outline"
                    onClick={handleUploadFile}
                    className="gap-2"
                  >
                    <UploadIcon className="size-4" />
                    选择 JSON 配置文件
                  </Button>
                  <p className="text-xs text-muted-foreground">选择一个 .json 配置文件上传，上传后可编辑</p>
                </div>
              ) : (
                <textarea
                  id="mcpConfig"
                  value={mcpConfigText}
                  onChange={(e) => { setMcpConfigText(e.target.value); setMcpConfigError('') }}
                  placeholder={MCP_TEMPLATE}
                  rows={10}
                  className="flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-xs font-mono ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-y"
                />
              )}
              {mcpConfigError ? <p className="text-xs text-destructive">{mcpConfigError}</p> : null}
            </div>

            {saveError ? (
              <Alert variant="destructive">
                <AlertCircleIcon className="size-4" />
                <AlertTitle>保存失败</AlertTitle>
                <AlertDescription>{saveError}</AlertDescription>
              </Alert>
            ) : null}

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => { setEditOpen(false); resetForm() }}>取消</Button>
              <Button
                disabled={saving || !mcpName.trim() || !mcpConfigText.trim()}
                onClick={handleSave}
              >
                {saving ? '保存中…' : '保存'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={detailItem !== null} onOpenChange={(o) => { if (!o) setDetailItem(null) }}>
        <DialogContent className="max-w-lg max-h-[calc(100dvh-4rem)] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{detailItem?.name}</DialogTitle>
            <DialogDescription>MCP 配置详情</DialogDescription>
          </DialogHeader>
          {detailItem ? (
            <div className="flex flex-col gap-3">
              {detailItem.description ? (
                <p className="text-sm text-muted-foreground">{detailItem.description}</p>
              ) : null}
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>创建于 {new Date(detailItem.createdAt).toLocaleString('zh-CN')}</span>
                <span>·</span>
                <span>更新于 {new Date(detailItem.updatedAt).toLocaleString('zh-CN')}</span>
              </div>
              <pre className="text-xs font-mono bg-muted/30 rounded-md p-4 max-h-96 overflow-auto border">
                {JSON.stringify(detailItem.config, null, 2)}
              </pre>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => handleEdit(detailItem)}>
                  编辑
                </Button>
                <Button variant="outline" onClick={() => setDetailItem(null)}>
                  关闭
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={deleteId !== null} onOpenChange={(o) => { if (!o) setDeleteId(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认删除MCP配置</DialogTitle>
            <DialogDescription>删除后配置将被永久移除。已引用此配置的插件包将失去 MCP 功能。</DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDeleteId(null)}>取消</Button>
            <Button variant="destructive" onClick={() => deleteId && handleDelete(deleteId)}>
              删除
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
