import { useEffect, useState } from 'react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ImageIcon, XIcon } from 'lucide-react'
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
import { getEventCenter, getErrorMessage, validateUserKey } from '@/lib/eventCenter'
import type { ProfileItem } from '@/lib/eventCenter'

export function ProfileSetupView({
  onComplete
}: {
  onComplete: (userKey: string) => Promise<void>
}) {
  const [userKey, setUserKey] = useState('')
  const [nickname, setNickname] = useState('')
  const [avatar, setAvatar] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [existingProfiles, setExistingProfiles] = useState<ProfileItem[]>([])
  const [loadingProfiles, setLoadingProfiles] = useState(true)
  const [hasAttempted, setHasAttempted] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<ProfileItem | null>(null)

  const canSubmit = validateUserKey(userKey)
  // Only show real-time validation after a failed submit attempt
  const showFormatAlert = hasAttempted && !error && userKey && !canSubmit

  useEffect(() => {
    const eventCenter = getEventCenter()
    if (!eventCenter?.listProfiles) return
    ;(async () => {
      try {
        const { profiles } = await eventCenter.listProfiles()
        setExistingProfiles(profiles)
      } catch {
        // Non-fatal
      } finally {
        setLoadingProfiles(false)
      }
    })()
  }, [])

  async function handlePickAvatar() {
    const eventCenter = getEventCenter()
    if (!eventCenter?.pickFiles) return
    try {
      const { files } = await eventCenter.pickFiles({
        multi: false,
        filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp'] }]
      })
      if (files.length === 0) return
      const img = await eventCenter.readImageAsBase64({
        path: files[0],
        maxWidth: 256,
        maxHeight: 256,
        quality: 0.8
      })
      setAvatar(img.base64)
    } catch (e: unknown) {
      setError(getErrorMessage(e) || '选择头像失败')
    }
  }

  async function handleSubmit() {
    const ek = userKey.trim()
    if (!ek || !canSubmit) {
      setError('用户名格式不正确（仅允许字母数字、下划线、短横线，3-64 位）')
      setHasAttempted(true)
      return
    }
    if (!nickname.trim()) {
      setError('请输入显示名称')
      return
    }
    const eventCenter = getEventCenter()
    if (!eventCenter?.setLocalProfile) {
      setError('未检测到 Electron eventCenter')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      await eventCenter.setLocalProfile({ userKey: ek, nickname: nickname.trim(), avatar: avatar || '' })
      await onComplete(ek)
    } catch (e: unknown) {
      setError(getErrorMessage(e) || '保存失败')
      setSubmitting(false)
    }
  }

  async function handleDeleteProfile(profile: ProfileItem) {
    const eventCenter = getEventCenter()
    if (!eventCenter?.deleteProfile) return
    setSubmitting(true)
    setError(null)
    try {
      await eventCenter.deleteProfile({ userKey: profile.userKey })
      // Refresh the profile list
      const { profiles } = await eventCenter.listProfiles()
      setExistingProfiles(profiles)
    } catch (e: unknown) {
      setError(getErrorMessage(e) || '删除失败')
    } finally {
      setSubmitting(false)
      setDeleteTarget(null)
    }
  }

  async function handleSwitchProfile(profile: ProfileItem) {
    const eventCenter = getEventCenter()
    if (!eventCenter?.switchProfile) return
    setSubmitting(true)
    setError(null)
    try {
      await eventCenter.switchProfile({ userKey: profile.userKey })
      await onComplete(profile.userKey)
    } catch (e: unknown) {
      setError(getErrorMessage(e) || '切换失败')
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-dvh">
      <div className="relative grid min-h-dvh lg:grid-cols-2">
        <div className="relative hidden border-r border-border bg-muted lg:block">
          <div className="absolute inset-0 bg-[radial-gradient(900px_circle_at_10%_10%,oklch(1_0_0),transparent_60%),radial-gradient(900px_circle_at_90%_30%,oklch(0.97_0_0),transparent_55%)]" />
          <div className="relative flex h-full flex-col justify-between p-10">
            <div className="text-5xl font-semibold tracking-tight">哈基米</div>
            <div className="text-5xl flex-1 flex flex-col items-center justify-center gap-15">
              <span>本</span>
              <span>地</span>
              <span>工</span>
              <span>作</span>
              <span>台</span>
            </div>
            <div className="max-w-md">
              <div className="text-sm text-muted-foreground">设置头像和昵称即可开始</div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-center p-6">
          <div className="w-full max-w-sm">
            <Card>
              <CardHeader>
                <CardTitle>创建用户</CardTitle>
                <CardDescription>设置你的本地账户信息</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col gap-4">
                  {/* Avatar picker */}
                  <div className="flex flex-col items-center gap-3">
                    <button
                      type="button"
                      className="relative size-20 rounded-full overflow-hidden border-2 border-dashed border-muted-foreground/30 hover:border-primary/50 transition-colors bg-muted flex items-center justify-center"
                      onClick={handlePickAvatar}
                      title="点击选择头像"
                    >
                      {avatar ? (
                        <img src={avatar} alt="头像" className="size-full object-cover" />
                      ) : (
                        <ImageIcon className="size-6 text-muted-foreground" />
                      )}
                    </button>
                    <Button
                      type="button"
                      variant="link"
                      size="sm"
                      className="h-auto p-0 text-xs"
                      onClick={handlePickAvatar}
                    >
                      {avatar ? '更换头像' : '选择头像'}
                    </Button>
                  </div>

                  <div className="flex flex-col gap-2">
                    <Label htmlFor="profileUserKey">用户名</Label>
                    <Input
                      id="profileUserKey"
                      value={userKey}
                      onChange={(e) => {
                        setUserKey(e.target.value)
                        setError(null)
                      }}
                      placeholder="字母数字、下划线、短横线（3-64 位）"
                      spellCheck={false}
                      inputMode="text"
                      aria-invalid={showFormatAlert || Boolean(error)}
                    />
                  </div>

                  <div className="flex flex-col gap-2">
                    <Label htmlFor="profileNickname">显示名称</Label>
                    <Input
                      id="profileNickname"
                      value={nickname}
                      onChange={(e) => {
                        setNickname(e.target.value)
                        setError(null)
                      }}
                      placeholder="你想怎么被称呼？"
                      autoComplete="nickname"
                      aria-invalid={Boolean(error)}
                    />
                  </div>

                  {showFormatAlert ? (
                    <Alert variant="destructive">
                      <AlertTitle>格式不正确</AlertTitle>
                      <AlertDescription>仅允许字母数字、下划线、短横线（3-64 位）。</AlertDescription>
                    </Alert>
                  ) : null}

                  {error ? (
                    <Alert variant="destructive">
                      <AlertTitle>保存失败</AlertTitle>
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  ) : null}
                </div>
              </CardContent>
              <CardFooter className="flex-col items-stretch gap-2">
                <Button
                  className="w-full"
                  disabled={!canSubmit || !nickname.trim() || submitting}
                  onClick={handleSubmit}
                >
                  {submitting ? '保存中…' : '进入'}
                </Button>
              </CardFooter>
            </Card>

            {/* Existing profiles */}
            {!loadingProfiles && existingProfiles.length > 0 ? (
              <div className="mt-6">
                <div className="text-xs text-muted-foreground text-center mb-3">或切换到已有账户</div>
                <div className="flex flex-wrap justify-center gap-2">
                  {existingProfiles.map((p) => (
                    <div key={p.userKey} className="relative group">
                      <button
                        type="button"
                        className="flex items-center gap-2 rounded-full border bg-card px-3 py-2 pr-8 text-sm hover:bg-accent transition-colors"
                        onClick={() => handleSwitchProfile(p)}
                        disabled={submitting}
                      >
                        {p.avatar ? (
                          <img src={p.avatar} alt="" className="size-5 rounded-full object-cover" />
                        ) : (
                          <div className="size-5 rounded-full bg-muted flex items-center justify-center text-[10px] font-medium">
                            {p.nickname.slice(0, 1).toUpperCase()}
                          </div>
                        )}
                        <span className="max-w-[100px] truncate">{p.nickname}</span>
                      </button>
                      <button
                        type="button"
                        className="absolute right-0.5 top-1/2 -translate-y-1/2 size-5 rounded-full flex items-center justify-center text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-all"
                        onClick={(e) => {
                          e.stopPropagation()
                          setDeleteTarget(p)
                        }}
                        disabled={submitting}
                        aria-label={`移除 ${p.nickname}`}
                        title={`移除 ${p.nickname}`}
                      >
                        <XIcon className="size-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* Delete profile confirmation dialog */}
      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认移除账户</AlertDialogTitle>
            <AlertDialogDescription>
              将移除账户「{deleteTarget?.nickname || deleteTarget?.userKey || ''}」，该账户的应用和配置数据不会被删除，但将无法再通过此界面快速切换。确定继续吗？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteTarget(null)} disabled={submitting}>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteTarget) handleDeleteProfile(deleteTarget)
              }}
              disabled={submitting}
            >
              {submitting ? '移除中…' : '确认移除'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
