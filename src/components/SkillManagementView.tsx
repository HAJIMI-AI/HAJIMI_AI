import { useCallback, useEffect, useState } from 'react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { AlertCircleIcon, FolderOpenIcon, PackageIcon, PuzzleIcon, TrashIcon, PencilIcon, CheckIcon, CableIcon } from 'lucide-react'
import { getEventCenter, getErrorMessage } from '@/lib/eventCenter'
import type { SkillItem, PluginPackItem, ManagedAppItem, McpConfigItem } from '@/lib/eventCenter'
import { McpManagementView } from '@/components/McpManagementView'

export function SkillManagementView() {
  const [subTab, setSubTab] = useState<'skills' | 'mcp' | 'packs'>('skills')

  // --- Skills state ---
  const [skills, setSkills] = useState<SkillItem[]>([])
  const [skillsLoading, setSkillsLoading] = useState(false)
  const [skillsError, setSkillsError] = useState<string | null>(null)

  const [uploadOpen, setUploadOpen] = useState(false)
  const [uploadName, setUploadName] = useState('')
  const [uploadDir, setUploadDir] = useState('')
  const [uploadSaving, setUploadSaving] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

  // Batch import state
  const [batchOpen, setBatchOpen] = useState(false)
  const [batchParentDir, setBatchParentDir] = useState('')
  const [batchScanning, setBatchScanning] = useState(false)
  const [batchScanError, setBatchScanError] = useState<string | null>(null)
  const [batchDirs, setBatchDirs] = useState<{ name: string; alias: string; path: string; hasSkillMd: boolean; fileCount: number; checked: boolean }[]>([])
  const [batchImporting, setBatchImporting] = useState(false)
  const [batchResult, setBatchResult] = useState<{ skills: SkillItem[]; errors: { name: string; error: string }[] } | null>(null)
  const [batchDupConfirmIndex, setBatchDupConfirmIndex] = useState<number | null>(null)

  const [deleteSkillId, setDeleteSkillId] = useState<string | null>(null)
  const [skillCtxMenu, setSkillCtxMenu] = useState<{ id: string; x: number; y: number } | null>(null)
  const [skillFilter, setSkillFilter] = useState<'all' | 'shared' | 'app'>('all')
  const [skillSearch, setSkillSearch] = useState('')

  // Skill detail/edit
  const [detailSkill, setDetailSkill] = useState<SkillItem | null>(null)
  const [detailSkillMd, setDetailSkillMd] = useState<{ content: string; frontmatter: Record<string, string> } | null>(null)
  const [detailSkillMdLoading, setDetailSkillMdLoading] = useState(false)
  const [editSkillId, setEditSkillId] = useState<string | null>(null)
  const [editSkillName, setEditSkillName] = useState('')
  const [editSkillSaving, setEditSkillSaving] = useState(false)
  const [editSkillError, setEditSkillError] = useState<string | null>(null)

  // --- Plugin packs state ---
  const [packs, setPacks] = useState<PluginPackItem[]>([])
  const [packsLoading, setPacksLoading] = useState(false)
  const [packsError, setPacksError] = useState<string | null>(null)

  const [packEditOpen, setPackEditOpen] = useState(false)
  const [editingPackId, setEditingPackId] = useState<string | null>(null)
  const [packName, setPackName] = useState('')
  const [packDesc, setPackDesc] = useState('')
  const [packSkillIds, setPackSkillIds] = useState<string[]>([])
  const [packMcpConfigIds, setPackMcpConfigIds] = useState<string[]>([])
  const [packSaving, setPackSaving] = useState(false)
  const [packSaveError, setPackSaveError] = useState<string | null>(null)

  // Picker dialogs for pack
  const [skillPickerOpen, setSkillPickerOpen] = useState(false)
  const [mcpPickerOpen, setMcpPickerOpen] = useState(false)
  const [skillPickerSearch, setSkillPickerSearch] = useState('')
  const [mcpPickerSearch, setMcpPickerSearch] = useState('')

  const [deletePackId, setDeletePackId] = useState<string | null>(null)
  const [packFilter, setPackFilter] = useState<'all' | 'shared' | 'app'>('all')
  const [packSearch, setPackSearch] = useState('')

  // MCP configs for pack selection
  const [mcpConfigsForPack, setMcpConfigsForPack] = useState<McpConfigItem[]>([])

  // App name lookup (for scope display)
  const [apps, setApps] = useState<ManagedAppItem[]>([])

  // --- Data loading ---
  const loadSkills = useCallback(async () => {
    const ec = getEventCenter()
    if (!ec) return
    setSkillsLoading(true)
    setSkillsError(null)
    try {
      const res = await ec.listSkills({}) as SkillItem[]
      setSkills(Array.isArray(res) ? res : [])
    } catch (e) {
      setSkillsError(getErrorMessage(e))
    } finally {
      setSkillsLoading(false)
    }
  }, [])

  const loadPacks = useCallback(async () => {
    const ec = getEventCenter()
    if (!ec) return
    setPacksLoading(true)
    try {
      const res = await ec.listPluginPacks({}) as PluginPackItem[]
      setPacks(Array.isArray(res) ? res : [])
    } catch (e) {
      setPacksError(getErrorMessage(e))
    } finally {
      setPacksLoading(false)
    }
  }, [])

  const loadApps = useCallback(async () => {
    const ec = getEventCenter()
    if (!ec) return
    try {
      const res = await ec.invoke('apps', 'list', []) as { apps: ManagedAppItem[] }
      setApps(Array.isArray(res?.apps) ? res.apps : [])
    } catch { /* ignore */ }
  }, [])

  const loadMcpConfigs = useCallback(async () => {
    const ec = getEventCenter()
    if (!ec) return
    try {
      const res = await ec.listMcpConfigs({}) as McpConfigItem[]
      setMcpConfigsForPack(Array.isArray(res) ? res : [])
    } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    void loadSkills()
    void loadPacks()
    void loadApps()
    void loadMcpConfigs()
  }, [loadSkills, loadPacks, loadApps, loadMcpConfigs])

  // Refresh MCP configs when switching to packs tab (they may have been created in MCP tab)
  useEffect(() => {
    if (subTab === 'packs') {
      void loadMcpConfigs()
    }
  }, [subTab, loadMcpConfigs])

  // Load SKILL.md content when detail skill changes
  useEffect(() => {
    if (!detailSkill) {
      setDetailSkillMd(null)
      return
    }
    let cancelled = false
    setDetailSkillMdLoading(true)
    setDetailSkillMd(null)
    const ec = getEventCenter()
    if (!ec) { setDetailSkillMdLoading(false); return }
    ec.readSkillMd({ id: detailSkill.id }).then((res) => {
      if (!cancelled) {
        setDetailSkillMd({ content: res.content, frontmatter: res.frontmatter || {} })
        setDetailSkillMdLoading(false)
      }
    }).catch(() => {
      if (!cancelled) {
        setDetailSkillMd({ content: '', frontmatter: {} })
        setDetailSkillMdLoading(false)
      }
    })
    return () => { cancelled = true }
  }, [detailSkill?.id])

  // Resolve appId → display name
  const appName = (scope: string) => {
    if (scope === 'shared') return null
    const app = apps.find(a => a.hsq?.appId === scope)
    return app?.alias || app?.hsq?.appName || scope
  }

  // Close context menu on outside click
  useEffect(() => {
    if (!skillCtxMenu) return
    const handle = () => setSkillCtxMenu(null)
    window.addEventListener('click', handle)
    window.addEventListener('contextmenu', handle)
    return () => {
      window.removeEventListener('click', handle)
      window.removeEventListener('contextmenu', handle)
    }
  }, [skillCtxMenu])

  // --- Skill upload ---
  const handleUploadSkill = async () => {
    const ec = getEventCenter()
    if (!ec) return
    setUploadSaving(true)
    setUploadError(null)
    try {
      await ec.uploadSkill({ name: uploadName.trim() || undefined, sourceDirectory: uploadDir })
      setUploadOpen(false)
      setUploadName('')
      setUploadDir('')
      await loadSkills()
    } catch (e) {
      setUploadError(getErrorMessage(e))
    } finally {
      setUploadSaving(false)
    }
  }

  const handlePickSkillDir = async () => {
    const ec = getEventCenter()
    if (!ec) return
    try {
      const res = await ec.invoke('apps', 'pickDirectory', []) as { directory: string | null }
      if (res?.directory) {
        setUploadDir(res.directory)
        setUploadError(null)
      }
    } catch (e) {
      setUploadError(getErrorMessage(e))
    }
  }

  // --- Batch import handlers ---
  const handlePickBatchParentDir = async () => {
    const ec = getEventCenter()
    if (!ec) return
    try {
      const res = await ec.invoke('apps', 'pickDirectory', []) as { directory: string | null }
      if (res?.directory) {
        setBatchParentDir(res.directory)
        setBatchScanError(null)
        setBatchDirs([])
        setBatchResult(null)
        // Auto-scan
        setBatchScanning(true)
        try {
          const scanRes = await ec.scanSkillDirs({ parentDirectory: res.directory })
          const dirs = (scanRes?.directories || []).map((d: { name: string; path: string; hasSkillMd: boolean; fileCount: number }) => ({
            name: d.name,
            alias: '',
            path: d.path,
            hasSkillMd: d.hasSkillMd,
            fileCount: d.fileCount,
            checked: false
          }))
          setBatchDirs(dirs)
        } catch (e) {
          setBatchScanError(getErrorMessage(e))
        } finally {
          setBatchScanning(false)
        }
      }
    } catch (e) {
      setBatchScanError(getErrorMessage(e))
    }
  }

  const toggleBatchDir = (index: number) => {
    const d = batchDirs[index]
    if (!d || !d.hasSkillMd) return

    // When checking a duplicate, require confirmation first
    const isChecking = !d.checked
    if (isChecking) {
      const nameToCheck = d.alias.trim() || d.name
      const dup = skills.find(s => s.name.toLowerCase() === nameToCheck.toLowerCase())
      if (dup) {
        setBatchDupConfirmIndex(index)
        return
      }
    }

    setBatchDirs(prev => {
      const next = prev.slice()
      next[index] = { ...next[index], checked: !next[index].checked }
      return next
    })
  }

  const confirmDupAndCheck = () => {
    if (batchDupConfirmIndex === null) return
    setBatchDirs(prev => {
      const next = prev.slice()
      next[batchDupConfirmIndex] = { ...next[batchDupConfirmIndex], checked: true }
      return next
    })
    setBatchDupConfirmIndex(null)
  }

  const setBatchDirAlias = (index: number, alias: string) => {
    setBatchDirs(prev => {
      const next = prev.slice()
      next[index] = { ...next[index], alias }
      return next
    })
  }

  const toggleAllBatchDirs = (checked: boolean) => {
    setBatchDirs(prev => prev.map(d => {
      if (!d.hasSkillMd) return d
      if (checked) {
        const nameToCheck = d.alias.trim() || d.name
        const dup = skills.find(s => s.name.toLowerCase() === nameToCheck.toLowerCase())
        // Skip duplicates on select-all — user must individually confirm
        if (dup) return d
      }
      return { ...d, checked }
    }))
  }

  const handleBatchImport = async () => {
    const ec = getEventCenter()
    if (!ec) return
    const selected = batchDirs.filter(d => d.checked && d.hasSkillMd)
    if (!selected.length) return

    setBatchImporting(true)
    setBatchResult(null)
    try {
      const res = await ec.uploadSkills({
        items: selected.map(d => ({ sourceDirectory: d.path, name: d.alias.trim() || undefined }))
      })
      if (res.skills.length > 0) {
        await loadSkills()
      }
      // Auto-close on full success, show errors otherwise
      if (res.errors.length === 0) {
        setBatchOpen(false)
        setBatchParentDir('')
        setBatchDirs([])
        setBatchScanError(null)
        setBatchResult(null)
      } else {
        setBatchResult(res)
      }
    } catch (e) {
      setBatchScanError(getErrorMessage(e))
    } finally {
      setBatchImporting(false)
    }
  }

  // --- Skill delete ---
  const handleDeleteSkill = async (id: string) => {
    const ec = getEventCenter()
    if (!ec) return
    try {
      await ec.deleteSkill({ id })
      if (detailSkill?.id === id) setDetailSkill(null)
      await loadSkills()
    } catch (e) {
      setSkillsError(getErrorMessage(e))
    } finally {
      setDeleteSkillId(null)
    }
  }

  // --- Skill update ---
  const handleUpdateSkill = async () => {
    const ec = getEventCenter()
    if (!ec) return
    setEditSkillSaving(true)
    setEditSkillError(null)
    try {
      await ec.updateSkill({ id: editSkillId!, name: editSkillName.trim() })
      setEditSkillId(null)
      setEditSkillName('')
      await loadSkills()
      // Refresh detail if open
      if (detailSkill?.id === editSkillId) {
        const res = await ec.listSkills({}) as SkillItem[]
        const updated = Array.isArray(res) ? res.find(s => s.id === editSkillId) : null
        if (updated) setDetailSkill(updated)
      }
    } catch (e) {
      setEditSkillError(getErrorMessage(e))
    } finally {
      setEditSkillSaving(false)
    }
  }

  const openEditSkill = (skill: SkillItem) => {
    setEditSkillId(skill.id)
    setEditSkillName(skill.name)
    setEditSkillError(null)
  }

  // --- Plugin pack save ---
  const handleSavePack = async () => {
    const ec = getEventCenter()
    if (!ec) return

    setPackSaving(true)
    setPackSaveError(null)
    try {
      if (editingPackId) {
        await ec.updatePluginPack({ id: editingPackId, name: packName, description: packDesc, skillIds: packSkillIds, mcpConfigIds: packMcpConfigIds })
      } else {
        await ec.createPluginPack({ name: packName, description: packDesc, skillIds: packSkillIds, mcpConfigIds: packMcpConfigIds })
      }
      setPackEditOpen(false)
      resetPackForm()
      await loadPacks()
    } catch (e) {
      setPackSaveError(getErrorMessage(e))
    } finally {
      setPackSaving(false)
    }
  }

  const handleDeletePack = async (id: string) => {
    const ec = getEventCenter()
    if (!ec) return
    try {
      await ec.deletePluginPack({ id })
      await loadPacks()
    } catch (e) {
      setPacksError(getErrorMessage(e))
    } finally {
      setDeletePackId(null)
    }
  }

  const resetPackForm = () => {
    setEditingPackId(null)
    setPackName('')
    setPackDesc('')
    setPackSkillIds([])
    setPackMcpConfigIds([])
    setPackSaveError(null)
  }

  const openEditPack = (pack: PluginPackItem) => {
    setEditingPackId(pack.id)
    setPackName(pack.name)
    setPackDesc(pack.description)
    setPackSkillIds(pack.skillIds)
    setPackMcpConfigIds(pack.mcpConfigIds || [])
    setPackSaveError(null)
    setPackEditOpen(true)
  }

  const toggleSkillInPack = (skillId: string) => {
    setPackSkillIds(prev =>
      prev.includes(skillId) ? prev.filter(id => id !== skillId) : [...prev, skillId]
    )
  }

  // --- UI helpers ---
  const scopeLabel = (scope: string) => {
    if (scope === 'shared') return '共享'
    return appName(scope) || '应用专属'
  }

  const scopeBadgeClass = (scope: string) => {
    if (scope === 'shared') return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
    return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
  }

  return (
    <div className="flex flex-col gap-4 h-full min-h-0">
      {/* Sub-tab switcher */}
      <ToggleGroup
        type="single"
        value={subTab}
        onValueChange={(v) => {
          if (v === 'skills' || v === 'mcp' || v === 'packs') setSubTab(v)
        }}
        className="w-full shrink-0"
      >
        <ToggleGroupItem value="skills" className="flex-1 justify-center gap-1.5">
          <PuzzleIcon className="size-4" />
          技能列表
        </ToggleGroupItem>
        <ToggleGroupItem value="mcp" className="flex-1 justify-center gap-1.5">
          <CableIcon className="size-4" />
          MCP管理
        </ToggleGroupItem>
        <ToggleGroupItem value="packs" className="flex-1 justify-center gap-1.5">
          <PackageIcon className="size-4" />
          插件包
        </ToggleGroupItem>
      </ToggleGroup>

      {/* ====== Skills Tab ====== */}
      {subTab === 'skills' ? (
        <div className="flex flex-col gap-4 flex-1 min-h-0">
          {/* Actions */}
          <div className="flex items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-2">
              <Button
                onClick={() => {
                  setUploadName('')
                  setUploadDir('')
                  setUploadError(null)
                  setUploadOpen(true)
                }}
              >
                上传技能
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setBatchParentDir('')
                  setBatchDirs([])
                  setBatchScanError(null)
                  setBatchResult(null)
                  setBatchOpen(true)
                }}
              >
                批量导入
              </Button>
              <Button variant="outline" onClick={loadSkills} disabled={skillsLoading}>
                {skillsLoading ? '刷新中…' : '刷新'}
              </Button>
            </div>

            {/* Search + Scope filter */}
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={skillSearch}
                onChange={(e) => setSkillSearch(e.target.value)}
                placeholder="搜索技能…"
                className="h-7 w-36 rounded-md border border-input bg-background px-2.5 text-xs shadow-sm placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
              <ToggleGroup
                type="single"
                value={skillFilter}
                onValueChange={(v) => { if (v === 'all' || v === 'shared' || v === 'app') setSkillFilter(v) }}
                size="sm"
              >
                <ToggleGroupItem value="all" className="px-3 text-xs">
                  全部
                </ToggleGroupItem>
                <ToggleGroupItem value="shared" className="px-3 text-xs">
                  共享
                </ToggleGroupItem>
                <ToggleGroupItem value="app" className="px-3 text-xs">
                  应用专属
                </ToggleGroupItem>
              </ToggleGroup>
            </div>
          </div>

          <div className="overflow-y-auto flex-1 min-h-0">
          {skillsError ? (
            <Alert variant="destructive">
              <AlertCircleIcon className="size-4" />
              <AlertTitle>加载失败</AlertTitle>
              <AlertDescription>{skillsError}</AlertDescription>
            </Alert>
          ) : null}

          {/* Skills grid */}
          {skillsLoading ? (
            <div className="grid grid-cols-4 gap-x-5 gap-y-7">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex flex-col items-center gap-2.5">
                  <Skeleton className="w-[72px] h-[72px] rounded-[22.5%]" />
                  <Skeleton className="h-3 w-14 rounded-full" />
                </div>
              ))}
            </div>
          ) : skills.length ? (
            <div className="relative">
              <div className="grid grid-cols-4 gap-x-5 gap-y-7">
                {skills
                  .filter(s => {
                    if (skillSearch) {
                      const q = skillSearch.toLowerCase()
                      if (!s.name.toLowerCase().includes(q)) return false
                    }
                    if (skillFilter === 'shared') return s.scope === 'shared'
                    if (skillFilter === 'app') return s.scope !== 'shared'
                    return true
                  })
                  .map((s) => {
                  const hue = (s.id || s.name).split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360
                  return (
                    <div key={s.id} className="flex flex-col items-center gap-2.5">
                      <button
                        onClick={() => setDetailSkill(s)}
                        onContextMenu={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          setSkillCtxMenu({ id: s.id, x: e.clientX, y: e.clientY })
                        }}
                        className="relative w-[72px] h-[72px] rounded-[22.5%] overflow-hidden
                                   shadow-md shadow-black/10
                                   transition-all duration-150 ease-out
                                   hover:scale-105 hover:shadow-lg hover:shadow-black/15
                                   active:scale-95 active:shadow-sm
                                   focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      >
                        <div
                          className="w-full h-full flex items-center justify-center text-[28px] font-semibold text-white select-none"
                          style={{ background: `linear-gradient(135deg, hsl(${hue}, 65%, 55%), hsl(${hue + 25}, 60%, 45%))` }}
                        >
                          <PuzzleIcon className="size-7" />
                        </div>
                      </button>

                      <span className="text-[11px] leading-tight text-center text-foreground/75 font-medium max-w-[72px] line-clamp-2 select-none">
                        {s.name}
                      </span>

                      <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${scopeBadgeClass(s.scope)}`}>
                        {scopeLabel(s.scope)}
                      </span>
                    </div>
                  )
                })}
              </div>

              {/* Context menu */}
              {skillCtxMenu ? (
                <div
                  className="fixed z-50 min-w-[100px] rounded-xl border bg-popover p-1.5 shadow-xl animate-in fade-in-0 zoom-in-95"
                  style={{ left: skillCtxMenu.x - 50, top: skillCtxMenu.y - 10 }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    className="w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-accent transition-colors"
                    onClick={() => {
                      const skill = skills.find(s => s.id === skillCtxMenu.id)
                      if (skill) openEditSkill(skill)
                      setSkillCtxMenu(null)
                    }}
                  >
                    编辑
                  </button>
                  <button
                    className="w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-destructive/10 text-destructive transition-colors"
                    onClick={() => {
                      setDeleteSkillId(skillCtxMenu.id)
                      setSkillCtxMenu(null)
                    }}
                  >
                    删除
                  </button>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="rounded-3xl bg-muted/20 border border-dashed border-border/40 flex flex-col items-center justify-center py-16 gap-3">
              <div className="size-16 rounded-2xl bg-muted/50 flex items-center justify-center">
                <PuzzleIcon className="size-7 text-muted-foreground/60" />
              </div>
              <div className="text-center">
                <div className="text-sm font-medium text-muted-foreground">
                  {skillSearch
                    ? '没有匹配的技能'
                    : skillFilter !== 'all' ? '该分类下暂无技能' : '暂无技能'}
                </div>
                <div className="text-xs text-muted-foreground/60 mt-0.5">上传包含 SKILL.md 的目录</div>
              </div>
            </div>
          )}
          </div>

          {/* Upload Dialog */}
          <Dialog open={uploadOpen} onOpenChange={(o) => { setUploadOpen(o); if (!o) setUploadError(null) }}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>上传技能</DialogTitle>
                <DialogDescription>选择包含 SKILL.md 的技能目录</DialogDescription>
              </DialogHeader>
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="skillName">技能名称（可选）</Label>
                  <Input
                    id="skillName"
                    value={uploadName}
                    onChange={(e) => { setUploadName(e.target.value); setUploadError(null) }}
                    placeholder="不填则使用目录名"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="skillDir">技能目录</Label>
                  <div className="flex items-center gap-2">
                    <Input id="skillDir" value={uploadDir} readOnly placeholder="请选择包含 SKILL.md 的目录" />
                    <Button variant="outline" onClick={handlePickSkillDir}>
                      <FolderOpenIcon className="size-4" />
                    </Button>
                  </div>
                </div>
                {(() => {
                  const baseName = uploadDir ? (uploadDir.split('/').pop() || uploadDir.split('\\').pop() || '') : ''
                  // 有别名时按别名判断，无别名时按目录名判断
                  const checkName = uploadName.trim() || baseName
                  const dupSkill = checkName ? skills.find(s => s.name.toLowerCase() === checkName.toLowerCase()) : null
                  if (dupSkill) {
                    return (
                      <Alert className="border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20">
                        <AlertCircleIcon className="size-4 text-amber-600 dark:text-amber-400" />
                        <AlertTitle className="text-amber-800 dark:text-amber-300">重复导入提示</AlertTitle>
                        <AlertDescription className="text-amber-700 dark:text-amber-400">
                          技能「{dupSkill.name}」已存在，继续导入将创建重复副本。如需更新请先删除旧版本。
                        </AlertDescription>
                      </Alert>
                    )
                  }
                  return null
                })()}
                {uploadError ? (
                  <Alert variant="destructive">
                    <AlertCircleIcon className="size-4" />
                    <AlertTitle>上传失败</AlertTitle>
                    <AlertDescription>{uploadError}</AlertDescription>
                  </Alert>
                ) : null}
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setUploadOpen(false)}>取消</Button>
                  <Button disabled={uploadSaving || !uploadDir} onClick={handleUploadSkill}>
                    {uploadSaving ? '上传中…' : '上传'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {/* Batch Import Dialog */}
          <Dialog open={batchOpen} onOpenChange={(o) => { setBatchOpen(o); if (!o) { setBatchScanError(null); setBatchResult(null) } }}>
            <DialogContent className="max-w-lg max-h-[calc(100dvh-4rem)] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>批量导入技能</DialogTitle>
                <DialogDescription>选择一个父目录，自动扫描包含 SKILL.md 的子目录并批量导入</DialogDescription>
              </DialogHeader>
              <div className="flex flex-col gap-4">
                {/* Step 1: Pick parent directory */}
                <div className="flex flex-col gap-2">
                  <Label>父目录</Label>
                  <div className="flex items-center gap-2">
                    <Input value={batchParentDir} readOnly placeholder="请选择包含多个技能目录的父目录" />
                    <Button variant="outline" onClick={handlePickBatchParentDir} disabled={batchImporting}>
                      <FolderOpenIcon className="size-4" />
                    </Button>
                  </div>
                </div>

                {/* Scan error */}
                {batchScanError ? (
                  <Alert variant="destructive">
                    <AlertCircleIcon className="size-4" />
                    <AlertTitle>扫描失败</AlertTitle>
                    <AlertDescription>{batchScanError}</AlertDescription>
                  </Alert>
                ) : null}

                {/* Step 2: Scan results */}
                {batchScanning ? (
                  <div className="flex items-center gap-3 py-6 justify-center text-sm text-muted-foreground">
                    <span className="size-4 border-2 border-muted-foreground/30 border-t-muted-foreground rounded-full animate-spin" />
                    正在扫描目录…
                  </div>
                ) : batchDirs.length > 0 ? (
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs text-muted-foreground">
                        {(() => {
                          const validCount = batchDirs.filter(d => d.hasSkillMd).length
                          const dupCount = batchDirs.filter(d => d.hasSkillMd && skills.some(s => s.name.toLowerCase() === (d.alias.trim() || d.name).toLowerCase())).length
                          return `发现 ${validCount} 个有效技能目录（${batchDirs.length} 个子目录${dupCount > 0 ? `，其中 ${dupCount} 个已存在` : ''}）`
                        })()}
                      </Label>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => toggleAllBatchDirs(true)}
                          className="text-xs text-primary hover:underline"
                        >
                          全选
                        </button>
                        <span className="text-xs text-muted-foreground">/</span>
                        <button
                          onClick={() => toggleAllBatchDirs(false)}
                          className="text-xs text-primary hover:underline"
                        >
                          取消全选
                        </button>
                      </div>
                    </div>

                    <div className="max-h-64 overflow-y-auto border rounded-lg divide-y">
                      {batchDirs.map((d, i) => {
                        const nameToCheck = d.alias.trim() || d.name
                        const dup = skills.find(s => s.name.toLowerCase() === nameToCheck.toLowerCase())
                        return (
                        <div
                          key={d.path}
                          className={`flex items-center gap-3 px-3 py-2.5 transition-colors ${
                            d.hasSkillMd ? 'hover:bg-muted/50' : 'opacity-50'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={d.checked}
                            disabled={!d.hasSkillMd || batchImporting}
                            onChange={() => toggleBatchDir(i)}
                            className="size-4 rounded border-border text-primary focus:ring-1 focus:ring-ring accent-primary shrink-0"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-medium truncate">{d.name}</div>
                            {d.hasSkillMd ? (
                              <input
                                type="text"
                                value={d.alias}
                                onChange={(e) => setBatchDirAlias(i, e.target.value)}
                                placeholder="别名（可选）"
                                disabled={!d.hasSkillMd || batchImporting || d.checked}
                                className="mt-1 w-full text-xs rounded border border-input bg-background px-2 py-0.5 shadow-sm placeholder:text-muted-foreground/50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
                              />
                            ) : (
                              <div className="text-[10px] text-muted-foreground mt-0.5">
                                缺少 SKILL.md
                              </div>
                            )}
                          </div>
                          {d.hasSkillMd ? (
                            dup ? (
                              <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                                重复
                              </span>
                            ) : (
                              <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                                有效
                              </span>
                            )
                          ) : (
                            <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                              无效
                            </span>
                          )}
                        </div>
                      )})}
                    </div>
                  </div>
                ) : batchParentDir ? (
                  <div className="text-center py-6 text-sm text-muted-foreground">
                    该目录下未找到子目录
                  </div>
                ) : null}

                {/* Dup confirm dialog */}
                <Dialog open={batchDupConfirmIndex !== null} onOpenChange={(o) => { if (!o) setBatchDupConfirmIndex(null) }}>
                  <DialogContent>
                    {batchDupConfirmIndex !== null ? (() => {
                      const d = batchDirs[batchDupConfirmIndex]
                      if (!d) return null
                      const nameToCheck = d.alias.trim() || d.name
                      const dup = skills.find(s => s.name.toLowerCase() === nameToCheck.toLowerCase())
                      if (!dup) return null
                      return (
                        <>
                          <DialogHeader>
                            <DialogTitle>确认导入重复技能？</DialogTitle>
                            <DialogDescription>
                              技能「{nameToCheck}」已存在（{dup.name}），继续导入将创建副本。如需更新请先删除旧版本。
                            </DialogDescription>
                          </DialogHeader>
                          <div className="flex justify-end gap-2">
                            <Button variant="outline" onClick={() => setBatchDupConfirmIndex(null)}>取消</Button>
                            <Button variant="destructive" onClick={confirmDupAndCheck}>仍然导入</Button>
                          </div>
                        </>
                      )
                    })() : null}
                  </DialogContent>
                </Dialog>

                {/* Step 3: Import results */}
                {batchResult ? (
                  <div className={`rounded-lg border p-3 ${batchResult.errors.length > 0 ? 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800' : 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800'}`}>
                    <div className="text-sm font-medium mb-2">
                      {batchResult.skills.length > 0 ? `✅ 成功导入 ${batchResult.skills.length} 个技能` : null}
                      {batchResult.errors.length > 0 ? `，⚠️ ${batchResult.errors.length} 个失败` : null}
                    </div>
                    {batchResult.errors.length > 0 ? (
                      <div className="flex flex-col gap-1 max-h-24 overflow-y-auto">
                        {batchResult.errors.map((e, i) => (
                          <div key={i} className="text-xs text-destructive flex items-start gap-1">
                            <AlertCircleIcon className="size-3 shrink-0 mt-0.5" />
                            <span><strong>{e.name}</strong>: {e.error}</span>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {/* Actions */}
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => { setBatchOpen(false); setBatchScanError(null); setBatchResult(null) }}>
                    取消
                  </Button>
                  <Button
                    disabled={batchImporting || batchDirs.filter(d => d.checked && d.hasSkillMd).length === 0}
                    onClick={handleBatchImport}
                  >
                    {batchImporting ? (
                      <>
                        <span className="size-4 border-2 border-current/30 border-t-current rounded-full animate-spin mr-1.5" />
                        导入中…
                      </>
                    ) : (
                      `导入选中（${batchDirs.filter(d => d.checked && d.hasSkillMd).length}）`
                    )}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {/* Delete confirmation */}
          <Dialog open={deleteSkillId !== null} onOpenChange={(o) => { if (!o) setDeleteSkillId(null) }}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>确认删除</DialogTitle>
                <DialogDescription>删除后技能文件将被永久移除，无法恢复。</DialogDescription>
              </DialogHeader>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setDeleteSkillId(null)}>取消</Button>
                <Button variant="destructive" onClick={() => deleteSkillId && handleDeleteSkill(deleteSkillId)}>
                  删除
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* Skill Detail Dialog */}
          <Dialog open={detailSkill !== null} onOpenChange={(o) => { if (!o) { setDetailSkill(null); setDetailSkillMd(null) } }}>
            <DialogContent className="max-w-lg">
              {detailSkill ? (
                <>
                  <DialogHeader>
                    <DialogTitle className="text-xl">{detailSkill.name}</DialogTitle>
                    <DialogDescription>
                      创建于 {new Date(detailSkill.createdAt).toLocaleString('zh-CN', {
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                      <span className={`ml-2 px-1.5 py-0.5 rounded-full text-[10px] font-medium ${scopeBadgeClass(detailSkill.scope)}`}>
                        {scopeLabel(detailSkill.scope)}
                      </span>
                    </DialogDescription>
                  </DialogHeader>

                  {/* Skill description from SKILL.md */}
                  <div className="flex flex-col gap-3">
                    <div className="rounded-lg border bg-muted/30 p-4 max-h-64 overflow-y-auto">
                      {detailSkillMdLoading ? (
                        <div className="flex items-center gap-2 py-6 justify-center text-sm text-muted-foreground">
                          <span className="size-4 border-2 border-muted-foreground/30 border-t-muted-foreground rounded-full animate-spin" />
                          加载简介…
                        </div>
                      ) : detailSkillMd ? (
                        <div className="text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap break-words">
                          {detailSkillMd.frontmatter.description || detailSkillMd.content || '该技能暂无简介'}
                        </div>
                      ) : (
                        <div className="text-sm text-muted-foreground/50 text-center py-6">该技能暂无简介</div>
                      )}
                    </div>
                  </div>

                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => {
                      openEditSkill(detailSkill)
                      setDetailSkill(null)
                      setDetailSkillMd(null)
                    }}>
                      <PencilIcon className="size-3.5 mr-1" />
                      编辑名称
                    </Button>
                    <Button variant="outline" onClick={() => { setDetailSkill(null); setDetailSkillMd(null) }}>关闭</Button>
                  </div>
                </>
              ) : null}
            </DialogContent>
          </Dialog>

          {/* Edit Skill Dialog */}
          <Dialog open={editSkillId !== null} onOpenChange={(o) => { if (!o) { setEditSkillId(null); setEditSkillName(''); setEditSkillError(null) } }}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>编辑技能</DialogTitle>
                <DialogDescription>修改技能显示名称</DialogDescription>
              </DialogHeader>
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="editSkillName">技能名称</Label>
                  <Input
                    id="editSkillName"
                    value={editSkillName}
                    onChange={(e) => { setEditSkillName(e.target.value); setEditSkillError(null) }}
                    placeholder="输入技能名称"
                  />
                </div>
                {editSkillError ? (
                  <Alert variant="destructive">
                    <AlertCircleIcon className="size-4" />
                    <AlertTitle>保存失败</AlertTitle>
                    <AlertDescription>{editSkillError}</AlertDescription>
                  </Alert>
                ) : null}
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => { setEditSkillId(null); setEditSkillName(''); setEditSkillError(null) }}>取消</Button>
                  <Button disabled={editSkillSaving || !editSkillName.trim()} onClick={handleUpdateSkill}>
                    {editSkillSaving ? '保存中…' : '保存'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      ) : null}

      {/* ====== MCP Management Tab ====== */}
      {subTab === 'mcp' ? (
        <McpManagementView />
      ) : null}

      {/* ====== Plugin Packs Tab ====== */}
      {subTab === 'packs' ? (
        <div className="flex flex-col gap-4 flex-1 min-h-0">
          {/* Actions */}
          <div className="flex items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-2">
              <Button
                onClick={() => {
                  resetPackForm()
                  setPackEditOpen(true)
                }}
                disabled={skills.length === 0 && mcpConfigsForPack.length === 0}
                title={skills.length === 0 && mcpConfigsForPack.length === 0 ? '请先上传技能或创建 MCP 配置' : undefined}
              >
                创建插件包
              </Button>
              <Button variant="outline" onClick={loadPacks} disabled={packsLoading}>
                {packsLoading ? '刷新中…' : '刷新'}
              </Button>
              {skills.length === 0 && mcpConfigsForPack.length === 0 ? (
                <span className="text-xs text-muted-foreground">请先上传技能或创建 MCP 配置</span>
              ) : null}
            </div>

            {/* Search + Scope filter */}
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={packSearch}
                onChange={(e) => setPackSearch(e.target.value)}
                placeholder="搜索插件包…"
                className="h-7 w-36 rounded-md border border-input bg-background px-2.5 text-xs shadow-sm placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
              <ToggleGroup
                type="single"
                value={packFilter}
                onValueChange={(v) => { if (v === 'all' || v === 'shared' || v === 'app') setPackFilter(v) }}
                size="sm"
              >
                <ToggleGroupItem value="all" className="px-3 text-xs">
                  全部
                </ToggleGroupItem>
                <ToggleGroupItem value="shared" className="px-3 text-xs">
                  共享
                </ToggleGroupItem>
                <ToggleGroupItem value="app" className="px-3 text-xs">
                  专属
                </ToggleGroupItem>
              </ToggleGroup>
            </div>
          </div>

          <div className="overflow-y-auto flex-1 min-h-0">
          {packsError ? (
            <Alert variant="destructive">
              <AlertCircleIcon className="size-4" />
              <AlertTitle>加载失败</AlertTitle>
              <AlertDescription>{packsError}</AlertDescription>
            </Alert>
          ) : null}

          {/* Packs grid */}
          {packsLoading ? (
            <div className="grid grid-cols-3 gap-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <Card key={i}>
                  <CardHeader>
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-3 w-40" />
                  </CardHeader>
                  <CardContent>
                    <div className="flex gap-1.5">
                      <Skeleton className="h-5 w-14 rounded-full" />
                      <Skeleton className="h-5 w-14 rounded-full" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : packs.length ? (
            <>
            {packs.filter(p => {
              if (packSearch) {
                const q = packSearch.toLowerCase()
                if (!p.name.toLowerCase().includes(q) && !p.description.toLowerCase().includes(q)) return false
              }
              if (packFilter === 'shared') return p.scope === 'shared'
              if (packFilter === 'app') return p.scope !== 'shared'
              return true
            }).length === 0 ? (
              <div className="rounded-3xl bg-muted/20 border border-dashed border-border/40 flex flex-col items-center justify-center py-16 gap-3">
                <div className="size-16 rounded-2xl bg-muted/50 flex items-center justify-center">
                  <PackageIcon className="size-7 text-muted-foreground/60" />
                </div>
                <div className="text-center">
                  <div className="text-sm font-medium text-muted-foreground">
                    {packSearch ? '没有匹配的插件包' : '该分类下暂无插件包'}
                  </div>
                  <div className="text-xs text-muted-foreground/60 mt-0.5">选择技能或 MCP 配置组合成一个插件包</div>
                </div>
              </div>
            ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {packs.filter(p => {
                if (packFilter === 'shared') return p.scope === 'shared'
                if (packFilter === 'app') return p.scope !== 'shared'
                return true
              }).map((p) => {
                const hue = (p.id || p.name).split('').reduce((acc: number, c: string) => acc + c.charCodeAt(0), 0) % 360
                // Use embedded data directly (self-contained packs)
                const packSkills = p.embeddedSkills || p.skillIds.map(sid => ({ id: sid, name: '未知', deleted: true }))
                const packMcps = p.embeddedMcpConfigs || p.mcpConfigIds.map(cid => ({ id: cid, name: '未知', deleted: true }))
                return (
                  <Card
                    key={p.id}
                    className="group cursor-pointer transition-all duration-200 border hover:shadow-md hover:border-primary/30"
                    onClick={() => {
                      resetPackForm()
                      setEditingPackId(p.id)
                      setPackName(p.name)
                      setPackDesc(p.description)
                      setPackSkillIds(p.skillIds)
                      setPackMcpConfigIds(p.mcpConfigIds || [])
                      setPackSaveError(null)
                      setPackEditOpen(true)
                    }}
                  >
                    <CardHeader className="pb-2">
                      <div className="flex items-start gap-3">
                        {/* Pack icon */}
                        <div
                          className="shrink-0 size-12 rounded-[22.5%] flex items-center justify-center shadow-sm"
                          style={{ background: `linear-gradient(135deg, hsl(${hue}, 55%, 50%), hsl(${hue + 30}, 50%, 40%))` }}
                        >
                          <PackageIcon className="size-5 text-white" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <CardTitle className="text-sm truncate">{p.name}</CardTitle>
                            <span className={`shrink-0 px-1.5 py-px text-[9px] font-medium rounded ${p.scope === 'shared' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'}`} title={p.scope !== 'shared' ? p.scope : undefined}>
                              {scopeLabel(p.scope)}
                            </span>
                            {p.hasMcp && p.mcpConfigIds?.length > 0 ? (
                              <span
                                className="shrink-0 px-1.5 py-px text-[9px] font-medium rounded bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                                title={packMcps.map(m => m.name).join(', ')}
                              >
                                MCP ×{p.mcpConfigIds.length}
                              </span>
                            ) : null}
                          </div>
                          {p.description ? (
                            <CardDescription className="text-xs mt-0.5 line-clamp-2">{p.description}</CardDescription>
                          ) : null}
                        </div>
                      </div>
                    </CardHeader>

                    <CardContent className="pt-0 pb-3 space-y-2">
                      {/* Skill chips */}
                      {packSkills.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {packSkills.map((sk) => (
                            <span
                              key={sk.id}
                              className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] truncate max-w-[120px] ${
                                sk.deleted
                                  ? 'bg-red-50 text-red-600 dark:bg-red-900/15 dark:text-red-400 line-through'
                                  : 'bg-muted text-muted-foreground'
                              }`}
                              title={sk.name + (sk.deleted ? '（已删除）' : '')}
                            >
                              <PuzzleIcon className="size-2.5 shrink-0" />
                              {sk.name}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-[10px] text-muted-foreground/50">{p.skillIds.length} 个技能</span>
                      )}

                      {/* Footer info */}
                      <div className="flex items-center justify-between text-[10px] text-muted-foreground/60">
                        <span>{new Date(p.updatedAt).toLocaleDateString('zh-CN')}</span>
                        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon-sm" className="size-5" onClick={() => openEditPack(p)}>
                                  <PencilIcon className="size-2.5" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>编辑</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  className="size-5"
                                  onClick={async () => {
                                    const ec = getEventCenter()
                                    if (!ec) return
                                    const r = await ec.getPackPluginPath(p.id) as { path: string }
                                    await navigator.clipboard.writeText(r.path).catch(() => {})
                                  }}
                                >
                                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>复制路径</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon-sm" className="size-5" onClick={() => setDeletePackId(p.id)}>
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
            )}
            </>
          ) : (
            <div className="rounded-3xl bg-muted/20 border border-dashed border-border/40 flex flex-col items-center justify-center py-16 gap-3">
              <div className="size-16 rounded-2xl bg-muted/50 flex items-center justify-center">
                <PackageIcon className="size-7 text-muted-foreground/60" />
              </div>
              <div className="text-center">
                <div className="text-sm font-medium text-muted-foreground">暂无插件包</div>
                <div className="text-xs text-muted-foreground/60 mt-0.5">选择技能或 MCP 配置组合成一个插件包</div>
              </div>
            </div>
          )}
          </div>

          {/* Create/Edit Pack Dialog */}
          <Dialog open={packEditOpen} onOpenChange={(o) => { setPackEditOpen(o); if (!o) resetPackForm() }}>
            <DialogContent className="max-w-lg max-h-[calc(100dvh-4rem)] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingPackId ? '编辑插件包' : '创建插件包'}</DialogTitle>
                <DialogDescription>选择技能和/或 MCP 配置（至少选一项）</DialogDescription>
              </DialogHeader>
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="packName">名称 *</Label>
                  <Input
                    id="packName"
                    value={packName}
                    onChange={(e) => setPackName(e.target.value)}
                    placeholder="例如：前端开发工具包"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="packDesc">描述</Label>
                  <Input
                    id="packDesc"
                    value={packDesc}
                    onChange={(e) => setPackDesc(e.target.value)}
                    placeholder="简要说明插件包用途"
                  />
                </div>

                {/* Skill selection */}
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <Label>选择技能（{packSkillIds.length} 已选）</Label>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1 h-7 text-xs"
                      onClick={() => { setSkillPickerSearch(''); setSkillPickerOpen(true) }}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>
                      添加
                    </Button>
                  </div>
                  {packSkillIds.length === 0 ? (
                    <div className="border border-dashed rounded-lg p-4 text-center">
                      <p className="text-xs text-muted-foreground">暂未选择技能，点击「添加」按钮选择</p>
                    </div>
                  ) : (
                    <div className="border rounded-lg p-2 flex flex-wrap gap-1.5 max-h-36 overflow-y-auto">
                      {packSkillIds.map(sid => {
                        const embedded = editingPackId
                          ? packs.find(p => p.id === editingPackId)?.embeddedSkills?.find(s => s.id === sid)
                          : null
                        const name = embedded?.name || skills.find(s => s.id === sid)?.name || sid
                        return (
                          <span
                            key={sid}
                            className="inline-flex items-center gap-1 rounded-md bg-primary/10 text-primary px-2 py-1 text-xs group/chip"
                            title={name}
                          >
                            <PuzzleIcon className="size-3 shrink-0" />
                            <span className="truncate max-w-[120px]">{name}</span>
                            <button
                              onClick={() => toggleSkillInPack(sid)}
                              className="shrink-0 rounded-full hover:bg-primary/20 p-0.5 opacity-60 hover:opacity-100"
                            >
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
                            </button>
                          </span>
                        )
                      })}
                    </div>
                  )}
                </div>

                {/* MCP Config selection */}
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <Label>选择 MCP 配置（{packMcpConfigIds.length} 已选，可选）</Label>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1 h-7 text-xs"
                      onClick={() => { setMcpPickerSearch(''); setMcpPickerOpen(true) }}
                      disabled={mcpConfigsForPack.length === 0}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>
                      添加
                    </Button>
                  </div>
                  {packMcpConfigIds.length > 0 ? (
                    /* Show selected chips */
                    <div className="border rounded-lg p-2 flex flex-wrap gap-1.5 max-h-36 overflow-y-auto">
                      {packMcpConfigIds.map(cid => {
                        const embedded = editingPackId
                          ? packs.find(p => p.id === editingPackId)?.embeddedMcpConfigs?.find(c => c.id === cid)
                          : null
                        const name = embedded?.name || mcpConfigsForPack.find(c => c.id === cid)?.name || cid
                        return (
                          <span
                            key={cid}
                            className="inline-flex items-center gap-1 rounded-md bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400 px-2 py-1 text-xs group/chip"
                            title={name}
                          >
                            <CableIcon className="size-3 shrink-0" />
                            <span className="truncate max-w-[120px]">{name}</span>
                            <button
                              onClick={() => setPackMcpConfigIds(prev => prev.filter(id => id !== cid))}
                              className="shrink-0 rounded-full p-0.5 opacity-60 hover:opacity-100 hover:bg-emerald-200 dark:hover:bg-emerald-800/30"
                            >
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
                            </button>
                          </span>
                        )
                      })}
                    </div>
                  ) : mcpConfigsForPack.length === 0 ? (
                    <div className="border border-dashed rounded-lg p-4 text-center">
                      <p className="text-xs text-muted-foreground">暂无可用的 MCP 配置，请先在 MCP管理 中创建</p>
                    </div>
                  ) : (
                    <div className="border border-dashed rounded-lg p-4 text-center">
                      <p className="text-xs text-muted-foreground">可选 MCP 配置（非必选），点击「添加」按钮选择</p>
                    </div>
                  )}
                </div>

                {packSaveError ? (
                  <Alert variant="destructive">
                    <AlertCircleIcon className="size-4" />
                    <AlertTitle>保存失败</AlertTitle>
                    <AlertDescription>{packSaveError}</AlertDescription>
                  </Alert>
                ) : null}

                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => { setPackEditOpen(false); resetPackForm() }}>取消</Button>
                  <Button
                    disabled={packSaving || !packName.trim() || (packSkillIds.length === 0 && packMcpConfigIds.length === 0)}
                    onClick={handleSavePack}
                  >
                    {packSaving ? '保存中…' : '保存'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {/* Delete pack confirmation */}
          <Dialog open={deletePackId !== null} onOpenChange={(o) => { if (!o) setDeletePackId(null) }}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>确认删除插件包</DialogTitle>
                <DialogDescription>删除后插件包文件将被永久移除。已引用的地方将失效。</DialogDescription>
              </DialogHeader>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setDeletePackId(null)}>取消</Button>
                <Button variant="destructive" onClick={() => deletePackId && handleDeletePack(deletePackId)}>
                  删除
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* Skill Picker Dialog */}
          <Dialog open={skillPickerOpen} onOpenChange={(o) => { if (!o) setSkillPickerOpen(false) }}>
            <DialogContent className="max-w-md max-h-[calc(100dvh-4rem)] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>选择技能</DialogTitle>
                <DialogDescription>点击切换选择，已选中项靠前显示</DialogDescription>
              </DialogHeader>
              <div className="flex flex-col gap-3">
                <Input
                  placeholder="搜索技能名称…"
                  value={skillPickerSearch}
                  onChange={(e) => setSkillPickerSearch(e.target.value)}
                />
                <div className="max-h-72 overflow-y-auto border rounded-lg p-1 flex flex-col gap-0.5">
                  {skills.length === 0 ? (
                    <p className="text-xs text-muted-foreground p-3 text-center">暂无可用技能，请先在技能列表中上传</p>
                  ) : (() => {
                    const q = skillPickerSearch.toLowerCase().trim()
                    const filtered = skills.filter(s => {
                      if (!q) return true
                      return s.name.toLowerCase().includes(q)
                    })
                    if (filtered.length === 0) {
                      return <p className="text-xs text-muted-foreground p-3 text-center">没有匹配「{skillPickerSearch}」的技能</p>
                    }
                    const sorted = [...filtered].sort((a, b) => {
                      const aSel = packSkillIds.includes(a.id) ? 1 : 0
                      const bSel = packSkillIds.includes(b.id) ? 1 : 0
                      return bSel - aSel
                    })
                    return sorted.map((s) => {
                      const alreadySelected = packSkillIds.includes(s.id)
                      return (
                        <button
                          key={s.id}
                          onClick={() => { toggleSkillInPack(s.id) }}
                          className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm text-left transition-colors
                            ${alreadySelected ? 'bg-primary/10 text-primary' : 'hover:bg-muted'}`}
                        >
                          <div className={`size-4 rounded border flex items-center justify-center shrink-0
                            ${alreadySelected ? 'bg-primary border-primary' : 'border-border'}`}
                          >
                            {alreadySelected ? <CheckIcon className="size-3 text-primary-foreground" /> : null}
                          </div>
                          <span className="truncate">{s.name}</span>
                          <span className={`text-[9px] px-1 rounded-full ml-auto shrink-0 ${scopeBadgeClass(s.scope)}`}>
                            {scopeLabel(s.scope)}
                          </span>
                        </button>
                      )
                    })
                  })()}
                </div>
                <div className="flex justify-end">
                  <Button variant="outline" onClick={() => setSkillPickerOpen(false)}>完成</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {/* MCP Picker Dialog */}
          <Dialog open={mcpPickerOpen} onOpenChange={(o) => { if (!o) setMcpPickerOpen(false) }}>
            <DialogContent className="max-w-md max-h-[calc(100dvh-4rem)] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>选择 MCP 配置</DialogTitle>
                <DialogDescription>点击切换选择，已选中项靠前显示</DialogDescription>
              </DialogHeader>
              <div className="flex flex-col gap-3">
                <Input
                  placeholder="搜索 MCP 配置名称…"
                  value={mcpPickerSearch}
                  onChange={(e) => setMcpPickerSearch(e.target.value)}
                />
                <div className="max-h-72 overflow-y-auto border rounded-lg p-1 flex flex-col gap-0.5">
                  {mcpConfigsForPack.length === 0 ? (
                    <p className="text-xs text-muted-foreground p-3 text-center">暂无可用 MCP 配置，请先在 MCP管理 中创建</p>
                  ) : (() => {
                    const q = mcpPickerSearch.toLowerCase().trim()
                    const filtered = mcpConfigsForPack.filter(c => {
                      if (!q) return true
                      return c.name.toLowerCase().includes(q)
                    })
                    if (filtered.length === 0) {
                      return <p className="text-xs text-muted-foreground p-3 text-center">没有匹配「{mcpPickerSearch}」的 MCP 配置</p>
                    }
                    const sortedCfg = [...filtered].sort((a, b) => {
                      const aSel = packMcpConfigIds.includes(a.id) ? 1 : 0
                      const bSel = packMcpConfigIds.includes(b.id) ? 1 : 0
                      return bSel - aSel
                    })
                    return sortedCfg.map((cfg) => {
                      const alreadySelected = packMcpConfigIds.includes(cfg.id)
                      const serverCount = (() => {
                        const servers = (cfg.config as Record<string, unknown>)?.mcpServers
                        if (servers && typeof servers === 'object') return Object.keys(servers).length
                        return Object.keys(cfg.config).length
                      })()
                      return (
                        <button
                          key={cfg.id}
                          onClick={() => {
                            if (alreadySelected) {
                              setPackMcpConfigIds(prev => prev.filter(id => id !== cfg.id))
                            } else {
                              setPackMcpConfigIds(prev => [...prev, cfg.id])
                            }
                          }}
                          className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm text-left transition-colors
                            ${alreadySelected ? 'bg-primary/10 text-primary' : 'hover:bg-muted'}`}
                        >
                          <div className={`size-4 rounded border flex items-center justify-center shrink-0
                            ${alreadySelected ? 'bg-primary border-primary' : 'border-border'}`}
                          >
                            {alreadySelected ? <CheckIcon className="size-3 text-primary-foreground" /> : null}
                          </div>
                          <span className="truncate">{cfg.name}</span>
                          <span className="text-[9px] text-muted-foreground ml-auto shrink-0">
                            {serverCount} 服务
                          </span>
                        </button>
                      )
                    })
                  })()}
                </div>
                <div className="flex justify-end">
                  <Button variant="outline" onClick={() => setMcpPickerOpen(false)}>完成</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      ) : null}
    </div>
  )
}
