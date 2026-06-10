import { useEffect, useState } from 'react'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { getEventCenter, getErrorMessage } from '@/lib/eventCenter'
import type { ManagedModelItem } from '@/lib/eventCenter'
import {
  ArrowLeftIcon,
  CpuIcon,
  EyeIcon,
  EyeOffIcon,
  PlusIcon,
  RefreshCwIcon,
  StarIcon,
  TrashIcon,
  PencilIcon,
  GlobeIcon,
  KeyIcon,
  SearchIcon
} from 'lucide-react'

interface Props {
  onBack: () => void
  /** Called when number of models changes (for parent to refresh badge) */
  onModelCountChange?: (count: number) => void
}

export function ModelManagementView({ onBack, onModelCountChange }: Props) {
  const [models, setModels] = useState<ManagedModelItem[]>([])
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  // Edit dialog
  const [editOpen, setEditOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [alias, setAlias] = useState('')
  const [name, setName] = useState('')
  const [apiUrl, setApiUrl] = useState('')
  const [apiToken, setApiToken] = useState('')
  const [tokenVisible, setTokenVisible] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)

  // Test connection
  // Delete
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const load = async () => {
    const ec = getEventCenter()
    if (!ec) return
    setLoading(true)
    setError(null)
    try {
      const [list, selId] = await Promise.all([
        ec.invoke('modules', 'listModels', []) as Promise<ManagedModelItem[]>,
        ec.invoke('modules', 'getSelectedModelId', []) as Promise<string | null>
      ])
      const arr = Array.isArray(list) ? list : []
      setModels(arr)
      setSelectedModelId(selId)
      onModelCountChange?.(arr.length)
    } catch (e: unknown) {
      setError(getErrorMessage(e) || '加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  const handleSetSelected = async (id: string) => {
    const ec = getEventCenter()
    if (!ec) return
    try {
      await ec.invoke('modules', 'setSelectedModel', [id])
      setSelectedModelId(id)
    } catch (e: unknown) {
      setError(getErrorMessage(e) || '设置失败')
    }
  }

  const openAdd = () => {
    setEditingId(null)
    setAlias('')
    setName('')
    setApiUrl('')
    setApiToken('')
    setTokenVisible(false)
    setEditError(null)
    setEditOpen(true)
  }

  const openEdit = (m: ManagedModelItem) => {
    setEditingId(m.id)
    setAlias(m.alias || '')
    setName(m.name || '')
    setApiUrl(m.api_url || '')
    setApiToken(m.api_token || '')
    setTokenVisible(false)
    setEditError(null)
    setEditOpen(true)
  }

  const save = async () => {
    const ec = getEventCenter()
    if (!ec) return
    if (!alias.trim() || !name.trim()) return
    setSaving(true)
    setEditError(null)
    try {
      if (editingId) {
        await ec.invoke('modules', 'updateModel', [editingId, { alias: alias.trim(), name: name.trim(), api_url: apiUrl.trim(), api_token: apiToken.trim() }])
      } else {
        await ec.invoke('modules', 'createModel', [{ alias: alias.trim(), name: name.trim(), api_url: apiUrl.trim(), api_token: apiToken.trim() }])
      }
      setEditOpen(false)
      await load()
    } catch (e: unknown) {
      setEditError(getErrorMessage(e) || '保存失败')
    } finally {
      setSaving(false)
    }
  }

  const del = async () => {
    if (!deleteId) return
    const ec = getEventCenter()
    if (!ec) return
    try {
      await ec.invoke('modules', 'deleteModel', [deleteId])
      setDeleteId(null)
      await load()
    } catch (e: unknown) {
      setError(getErrorMessage(e) || '删除失败')
    }
  }

  const filtered = search.trim()
    ? models.filter(m => {
        const q = search.toLowerCase()
        return (m.alias || '').toLowerCase().includes(q)
          || (m.name || '').toLowerCase().includes(q)
          || (m.api_url || '').toLowerCase().includes(q)
      })
    : models

  // Provider icon color based on URL
  const providerHue = (url: string) => {
    const u = url.toLowerCase()
    if (u.includes('anthropic')) return 30   // orange
    if (u.includes('openai')) return 200     // blue
    if (u.includes('deepseek')) return 260  // violet
    if (u.includes('gemini') || u.includes('google')) return 140 // green
    if (u.includes('groq')) return 0        // red
    return (url.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % 360)
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack} className="shrink-0">
            <ArrowLeftIcon className="size-4" />
          </Button>
          <div>
            <h2 className="text-lg font-semibold">模型管理</h2>
            <p className="text-xs text-muted-foreground">
              配置 AI 模型，供应用连接使用
              {!loading && models.length === 0 ? ' — 请先添加一个模型' : ` — ${models.length} 个模型`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCwIcon className={`size-3.5 mr-1 ${loading ? 'animate-spin' : ''}`} />
            刷新
          </Button>
          <Button size="sm" onClick={openAdd}>
            <PlusIcon className="size-3.5 mr-1" />
            新增模型
          </Button>
        </div>
      </div>

      {error ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      {/* Search */}
      {!loading && models.length > 0 ? (
        <div className="relative max-w-xs">
          <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="搜索模型…"
            className="pl-8 h-8 text-sm"
          />
        </div>
      ) : null}

      {/* Content */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-3">
                <Skeleton className="h-5 w-28" />
                <Skeleton className="h-3 w-48" />
              </CardHeader>
              <CardContent>
                <div className="flex gap-2">
                  <Skeleton className="h-8 flex-1" />
                  <Skeleton className="h-8 w-16" />
                  <Skeleton className="h-8 w-16" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filtered.length ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(m => {
            const isSelected = selectedModelId === m.id
            const hue = providerHue(m.api_url || m.name)
            return (
              <Card key={m.id} className={`group relative transition-shadow hover:shadow-md ${isSelected ? 'ring-2 ring-primary/40' : ''}`}>
                {isSelected ? (
                  <div className="absolute -top-2 -right-2 rounded-full bg-primary text-primary-foreground size-6 flex items-center justify-center shadow-sm">
                    <StarIcon className="size-3" fill="currentColor" />
                  </div>
                ) : null}
                <CardHeader className="pb-2">
                  <div className="flex items-start gap-3">
                    <div
                      className="size-10 rounded-xl shrink-0 flex items-center justify-center text-white text-sm font-bold shadow-sm"
                      style={{ background: `linear-gradient(135deg, hsl(${hue}, 60%, 50%), hsl(${hue + 20}, 55%, 40%))` }}
                    >
                      <CpuIcon className="size-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <CardTitle className="text-sm truncate">{m.alias}</CardTitle>
                      <CardDescription className="text-xs truncate mt-0.5">{m.name}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col gap-2">
                    {m.api_url ? (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground truncate">
                        <GlobeIcon className="size-3 shrink-0" />
                        <span className="truncate">{m.api_url}</span>
                      </div>
                    ) : null}
                    {m.api_token ? (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <KeyIcon className="size-3 shrink-0" />
                        <span>••••{m.api_token.slice(-4)}</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground/50">
                        <KeyIcon className="size-3 shrink-0" />
                        <span>未配置 Token</span>
                      </div>
                    )}
                    <div className="flex items-center gap-1.5 mt-1">
                      <Button
                        size="sm"
                        variant={isSelected ? 'default' : 'secondary'}
                        className="h-7 text-xs flex-1"
                        onClick={() => handleSetSelected(m.id)}
                      >
                        <StarIcon className={`size-3 mr-1 ${isSelected ? 'fill-current' : ''}`} />
                        {isSelected ? '当前默认' : '设为默认'}
                      </Button>
                      <Button size="icon" variant="ghost" className="size-7" onClick={() => openEdit(m)}>
                        <PencilIcon className="size-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="size-7 hover:text-destructive" onClick={() => setDeleteId(m.id)}>
                        <TrashIcon className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      ) : search.trim() ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 rounded-2xl border border-dashed border-border/40 bg-muted/10">
          <SearchIcon className="size-10 text-muted-foreground/40" />
          <div className="text-center">
            <p className="text-sm font-medium text-muted-foreground">无匹配模型</p>
            <p className="text-xs text-muted-foreground/60 mt-0.5">试试其他关键词</p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 gap-4 rounded-2xl border border-dashed border-border/40 bg-muted/10">
          <div className="size-20 rounded-2xl bg-muted/50 flex items-center justify-center">
            <CpuIcon className="size-10 text-muted-foreground/40" />
          </div>
          <div className="text-center max-w-sm">
            <p className="text-base font-semibold text-foreground/80">还没有配置模型</p>
            <p className="text-sm text-muted-foreground mt-1">
              AI 模型是应用运行的必要配置。添加一个模型后，所有应用都可以使用它进行对话。
            </p>
          </div>
          <Button onClick={openAdd} size="lg" className="rounded-full px-6">
            <PlusIcon className="size-4 mr-2" />
            添加第一个模型
          </Button>
        </div>
      )}

      {/* Edit / Add Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-lg max-h-[calc(100dvh-4rem)] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? '编辑模型' : '新增模型'}</DialogTitle>
            <DialogDescription>
              名称用于展示区分，模型名对应 API 实际模型标识
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="mAlias">名称 <span className="text-destructive">*</span></Label>
              <Input
                id="mAlias"
                value={alias}
                onChange={e => { setAlias(e.target.value); setEditError(null) }}
                placeholder="例如：Claude（公司账号）"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="mName">模型名 <span className="text-destructive">*</span></Label>
              <Input
                id="mName"
                value={name}
                onChange={e => { setName(e.target.value); setEditError(null) }}
                placeholder="例如：claude-sonnet-4-6"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="mUrl">API_URL</Label>
              <Input
                id="mUrl"
                value={apiUrl}
                onChange={e => { setApiUrl(e.target.value); setEditError(null) }}
                placeholder="例如：https://api.anthropic.com"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="mToken">API_TOKEN</Label>
              <div className="relative">
                <Input
                  id="mToken"
                  type={tokenVisible ? 'text' : 'password'}
                  value={apiToken}
                  onChange={e => { setApiToken(e.target.value); setEditError(null) }}
                  placeholder="sk-…"
                  className="pr-9"
                />
                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setTokenVisible(v => !v)}
                  tabIndex={-1}
                >
                  {tokenVisible ? <EyeOffIcon className="size-4" /> : <EyeIcon className="size-4" />}
                </button>
              </div>
            </div>

            {editError ? (
              <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{editError}</div>
            ) : null}

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditOpen(false)} disabled={saving}>取消</Button>
              <Button onClick={save} disabled={saving || !alias.trim() || !name.trim()}>
                {saving ? '保存中…' : '保存'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={v => { if (!v) setDeleteId(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              删除后将无法恢复。如果删除的是默认模型，需要重新设置默认。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteId(null)}>取消</AlertDialogCancel>
            <AlertDialogAction onClick={del}>删除</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
