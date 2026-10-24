import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowDown, ArrowUp, GripVertical, Link2, MessageSquare, Plus, Trash2, X } from 'lucide-react'
import { api, errorInfo } from '../lib/api'
import { useAccounts } from '../lib/accounts'
import type { Automation, DmButton, DmStep, IgPost } from '../lib/types'
import { Banner, Button, Card, ConfirmDialog, ErrorCard, Field, FormError, Input, PageHeader, Select, Skeleton, Textarea } from '../components/ui'
import { ReconnectBanners } from '../components/AccountBanners'
import { useToast } from '../components/toast'
import { useBeforeUnload } from '../components/useDirtyGuard'

const newId = () => `s${Math.random().toString(36).slice(2, 8)}`

function emptyStep(): DmStep {
  return { id: newId(), text: '', buttons: [] }
}

export default function AutomationEditorPage() {
  const { id } = useParams()
  const isNew = !id
  const navigate = useNavigate()
  const toast = useToast()
  const { accounts } = useAccounts()
  const connected = accounts.filter((a) => a.status === 'connected')

  const [loaded, setLoaded] = useState(isNew)
  const [loadError, setLoadError] = useState(false)
  const [name, setName] = useState('')
  const [accountId, setAccountId] = useState('')
  const [target, setTarget] = useState<'specific_post' | 'any_post'>('specific_post')
  const [igMediaId, setIgMediaId] = useState('')
  const [keywords, setKeywords] = useState<string[]>([])
  const [kwInput, setKwInput] = useState('')
  const [matchMode, setMatchMode] = useState<'contains' | 'exact'>('contains')
  const [steps, setSteps] = useState<DmStep[]>(() => [emptyStep()])
  const [posts, setPosts] = useState<IgPost[] | null>(null)
  const [postsError, setPostsError] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<{ message?: string; fields: Record<string, string> }>({ fields: {} })
  const [dirty, setDirty] = useState(false)
  const [leaveOpen, setLeaveOpen] = useState(false)
  const [dragIdx, setDragIdx] = useState<number | null>(null)
  useBeforeUnload(dirty)

  useEffect(() => {
    if (isNew) return
    api
      .get<Automation>(`/automations/${id}`)
      .then((r) => {
        const a = r.data
        setName(a.name)
        setAccountId(a.accountId)
        setTarget(a.target)
        setIgMediaId(a.igMediaId ?? '')
        setKeywords(a.keywords)
        setMatchMode(a.matchMode)
        const start = a.steps.find((s) => s.id === a.startStepId)
        setSteps(start ? [start, ...a.steps.filter((s) => s.id !== a.startStepId)] : a.steps)
        setLoaded(true)
      })
      .catch(() => setLoadError(true))
  }, [id, isNew])

  useEffect(() => {
    if (isNew && !accountId && connected[0]) setAccountId(connected[0].id)
  }, [connected, accountId, isNew])

  useEffect(() => {
    if (!accountId || target !== 'specific_post') return
    setPosts(null)
    setPostsError(false)
    api
      .get<IgPost[]>(`/instagram/accounts/${accountId}/media`)
      .then((r) => setPosts(r.data))
      .catch(() => setPostsError(true))
  }, [accountId, target])

  const account = accounts.find((a) => a.id === accountId)
  const touch = () => setDirty(true)

  const updateStep = (i: number, patch: Partial<DmStep>) => {
    touch()
    setSteps((cur) => cur.map((s, j) => (j === i ? { ...s, ...patch } : s)))
  }
  const updateButton = (i: number, b: number, patch: Partial<DmButton>) =>
    updateStep(i, { buttons: steps[i].buttons.map((x, k) => (k === b ? { ...x, ...patch } : x)) })

  const moveStep = (from: number, to: number) => {
    if (to < 0 || to >= steps.length || from === to) return
    touch()
    setSteps((cur) => {
      const next = [...cur]
      const [m] = next.splice(from, 1)
      next.splice(to, 0, m)
      return next
    })
  }

  const removeStep = (i: number) => {
    touch()
    const removed = steps[i].id
    setSteps((cur) =>
      cur
        .filter((_, j) => j !== i)
        .map((s) => ({ ...s, buttons: s.buttons.map((b) => (b.nextStepId === removed ? { ...b, nextStepId: null } : b)) })),
    )
  }

  const addKeyword = () => {
    const parts = kwInput
      .split(',')
      .map((k) => k.trim())
      .filter(Boolean)
    if (!parts.length) return
    touch()
    setKeywords((cur) => [...new Set([...cur, ...parts.map((p) => p.toLowerCase())])])
    setKwInput('')
  }

  const save = async () => {
    setSaving(true)
    setError({ fields: {} })
    const kws = kwInput.trim() ? [...new Set([...keywords, ...kwInput.split(',').map((k) => k.trim().toLowerCase()).filter(Boolean)])] : keywords
    const body = {
      accountId,
      name,
      target,
      igMediaId: target === 'specific_post' ? igMediaId || null : null,
      keywords: kws,
      matchMode,
      startStepId: steps[0]?.id,
      steps: steps.map((s) => ({
        ...s,
        buttons: s.buttons.map((b) => (b.type === 'url' ? { label: b.label, type: b.type, url: b.url } : { label: b.label, type: b.type, nextStepId: b.nextStepId || null })),
      })),
    }
    try {
      if (isNew) await api.post('/automations', body)
      else await api.patch(`/automations/${id}`, body)
      setDirty(false)
      toast({ tone: 'success', text: 'Automação salva.' })
      navigate('/automacoes')
    } catch (err) {
      const e = errorInfo(err)
      setError({ message: e.message, fields: e.fields })
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } finally {
      setSaving(false)
    }
  }

  if (loadError) return <ErrorCard onRetry={() => window.location.reload()} />
  if (!loaded)
    return (
      <div role="status" aria-label="Carregando">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="mt-6 h-96 w-full" />
      </div>
    )

  const stepError = (i: number) => Object.entries(error.fields).find(([k]) => k.startsWith(`steps.${i}`))?.[1]

  return (
    <div className="pb-20">
      <PageHeader title={isNew ? 'Nova automação' : 'Editar automação'} description={isNew ? undefined : 'Conversas em andamento seguem o fluxo antigo até acabar.'} />
      <ReconnectBanners />
      <FormError message={error.message} />

      <div className="grid gap-4 lg:grid-cols-[380px_1fr]">
        <Card className="flex h-fit flex-col gap-4 p-5">
          <h2 className="text-lg font-semibold">Gatilho</h2>
          <Field label="Nome" error={error.fields.name}>
            {(fid, d) => <Input id={fid} aria-describedby={d} value={name} maxLength={100} onChange={(e) => (touch(), setName(e.target.value))} placeholder="Ex.: Receita grátis" />}
          </Field>
          <Field label="Conta" error={error.fields.accountId}>
            {(fid, d) => (
              <Select id={fid} aria-describedby={d} value={accountId} onChange={(e) => (touch(), setAccountId(e.target.value), setIgMediaId(''))}>
                {connected.length === 0 && <option value="">Nenhuma conta conectada</option>}
                {accounts
                  .filter((a) => a.status === 'connected' || a.id === accountId)
                  .map((a) => (
                    <option key={a.id} value={a.id}>
                      @{a.username}
                    </option>
                  ))}
              </Select>
            )}
          </Field>
          <fieldset>
            <legend className="mb-2 text-sm font-medium">Alvo</legend>
            <div role="radiogroup" className="grid grid-cols-2 gap-2">
              {[
                { v: 'specific_post' as const, l: 'Um post' },
                { v: 'any_post' as const, l: 'Qualquer post' },
              ].map((o) => (
                <button key={o.v} type="button" role="radio" aria-checked={target === o.v} onClick={() => (touch(), setTarget(o.v))} className={`h-10 max-md:min-h-11 rounded-control border text-sm font-medium ${target === o.v ? 'border-brand bg-brand-soft text-brand-ink' : 'border-control'}`}>
                  {o.l}
                </button>
              ))}
            </div>
          </fieldset>
          {target === 'specific_post' && (
            <div>
              <span className="mb-2 block text-sm font-medium">Post</span>
              {postsError ? (
                <p className="text-sm text-negative">Não foi possível carregar os posts do Instagram.</p>
              ) : posts === null ? (
                <div className="grid grid-cols-3 gap-2">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <Skeleton key={i} className="aspect-square" />
                  ))}
                </div>
              ) : posts.length === 0 ? (
                <p className="text-sm text-muted">Nenhum post encontrado nesta conta.</p>
              ) : (
                <div role="radiogroup" aria-label="Post" className="grid max-h-72 grid-cols-3 gap-2 overflow-y-auto">
                  {posts.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      role="radio"
                      aria-checked={igMediaId === p.id}
                      aria-label={p.caption?.slice(0, 60) || `Post ${p.id}`}
                      onClick={() => (touch(), setIgMediaId(p.id))}
                      className={`relative aspect-square overflow-hidden rounded-control bg-raised ${igMediaId === p.id ? 'ring-2 ring-brand ring-offset-2 ring-offset-surface' : ''}`}
                    >
                      {(p.thumbnailUrl || p.mediaUrl) && <img src={p.thumbnailUrl || p.mediaUrl} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />}
                    </button>
                  ))}
                </div>
              )}
              {error.fields.igMediaId && <p className="mt-2 text-xs text-negative">{error.fields.igMediaId}</p>}
            </div>
          )}
          <div>
            <label htmlFor="kw" className="mb-2 block text-sm font-medium">
              Palavras-chave
            </label>
            <div className="mb-2 flex flex-wrap gap-1.5">
              {keywords.map((k) => (
                <span key={k} className="inline-flex h-7 items-center gap-1 rounded-full bg-raised pr-1 pl-2.5 text-sm">
                  {k}
                  <button type="button" aria-label={`Remover ${k}`} onClick={() => (touch(), setKeywords(keywords.filter((x) => x !== k)))} className="flex h-6 w-6 items-center justify-center rounded-full text-muted hover:text-ink">
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                id="kw"
                value={kwInput}
                aria-invalid={Boolean(error.fields.keywords)}
                onChange={(e) => setKwInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    addKeyword()
                  }
                }}
                placeholder="Ex.: receita, link"
              />
              <Button type="button" onClick={addKeyword}>
                Adicionar
              </Button>
            </div>
            {error.fields.keywords && <p className="mt-2 text-xs text-negative">{error.fields.keywords}</p>}
          </div>
          <Field label="Modo" hint={matchMode === 'contains' ? 'Dispara quando o comentário contém a palavra.' : 'Dispara quando o comentário é exatamente a palavra.'}>
            {(fid, d) => (
              <Select id={fid} aria-describedby={d} value={matchMode} onChange={(e) => (touch(), setMatchMode(e.target.value as 'contains' | 'exact'))}>
                <option value="contains">Contém</option>
                <option value="exact">Exata</option>
              </Select>
            )}
          </Field>
        </Card>

        <div className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">Fluxo</h2>
          {account && !account.firstStepButtons && (
            <Banner tone="warning">A Meta não aceita botões na primeira mensagem desta conta. Ela vai só em texto, pedindo uma resposta, e os botões seguem na próxima mensagem.</Banner>
          )}
          {error.fields.steps && <FormError message={error.fields.steps} />}
          <ol className="flex flex-col gap-3">
            {steps.map((s, i) => (
              <li
                key={s.id}
                draggable
                onDragStart={() => setDragIdx(i)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => {
                  if (dragIdx !== null) moveStep(dragIdx, i)
                  setDragIdx(null)
                }}
              >
                <Card className={`p-4 ${dragIdx === i ? 'opacity-50' : ''}`}>
                  <div className="mb-3 flex items-center gap-2">
                    <span className="cursor-grab text-faint" aria-hidden title="Arraste para reordenar">
                      <GripVertical size={16} />
                    </span>
                    <MessageSquare size={16} className="text-brand" aria-hidden />
                    <span className="font-medium">
                      Passo {i + 1}
                      {i === 0 && <span className="ml-2 text-xs font-normal text-muted">primeira mensagem</span>}
                    </span>
                    <div className="ml-auto flex gap-1">
                      <button type="button" aria-label={`Subir passo ${i + 1}`} disabled={i === 0} onClick={() => moveStep(i, i - 1)} className="flex h-8 w-8 max-md:h-11 max-md:w-11 items-center justify-center rounded-control hover:bg-raised disabled:opacity-40">
                        <ArrowUp size={14} />
                      </button>
                      <button type="button" aria-label={`Descer passo ${i + 1}`} disabled={i === steps.length - 1} onClick={() => moveStep(i, i + 1)} className="flex h-8 w-8 max-md:h-11 max-md:w-11 items-center justify-center rounded-control hover:bg-raised disabled:opacity-40">
                        <ArrowDown size={14} />
                      </button>
                      <button type="button" aria-label={`Apagar passo ${i + 1}`} disabled={steps.length === 1} onClick={() => removeStep(i)} className="flex h-8 w-8 max-md:h-11 max-md:w-11 items-center justify-center rounded-control text-muted hover:bg-raised disabled:opacity-40">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                  <Textarea aria-label={`Mensagem do passo ${i + 1}`} rows={3} maxLength={640} value={s.text} onChange={(e) => updateStep(i, { text: e.target.value })} placeholder="Escreva a mensagem" />
                  <p className="mt-1 text-xs text-faint tabular-nums">{s.text.length} de 640</p>
                  <div className="mt-3 flex flex-col gap-2">
                    {s.buttons.map((b, k) => (
                      <div key={k} className="grid gap-2 rounded-control bg-raised p-2 sm:grid-cols-[1fr_130px_1fr_auto]">
                        <Input aria-label={`Texto do botão ${k + 1} do passo ${i + 1}`} maxLength={20} value={b.label} onChange={(e) => updateButton(i, k, { label: e.target.value })} placeholder="Texto do botão" />
                        <Select aria-label={`Tipo do botão ${k + 1}`} value={b.type} onChange={(e) => updateButton(i, k, { type: e.target.value as 'postback' | 'url' })}>
                          <option value="postback">Resposta</option>
                          <option value="url">Link</option>
                        </Select>
                        {b.type === 'url' ? (
                          <Input aria-label={`Link do botão ${k + 1}`} type="url" value={b.url ?? ''} onChange={(e) => updateButton(i, k, { url: e.target.value })} placeholder="https://" />
                        ) : (
                          <Select aria-label={`Próximo passo do botão ${k + 1}`} value={b.nextStepId ?? ''} onChange={(e) => updateButton(i, k, { nextStepId: e.target.value || null })}>
                            <option value="">Encerrar conversa</option>
                            {steps.map((o, j) =>
                              o.id === s.id ? null : (
                                <option key={o.id} value={o.id}>
                                  Ir para o passo {j + 1}
                                </option>
                              ),
                            )}
                          </Select>
                        )}
                        <button type="button" aria-label={`Remover botão ${k + 1}`} onClick={() => updateStep(i, { buttons: s.buttons.filter((_, x) => x !== k) })} className="flex h-10 w-10 items-center justify-center justify-self-end rounded-control text-muted hover:bg-surface">
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                    {stepError(i) && <p className="text-xs text-negative">{stepError(i)}</p>}
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" disabled={s.buttons.length >= 3} icon={<Plus size={14} />} onClick={() => updateStep(i, { buttons: [...s.buttons, { label: '', type: 'postback', nextStepId: null }] })}>
                        Botão de resposta
                      </Button>
                      <Button type="button" disabled={s.buttons.length >= 3} icon={<Link2 size={14} />} onClick={() => updateStep(i, { buttons: [...s.buttons, { label: '', type: 'url', url: '' }] })}>
                        Botão de link
                      </Button>
                    </div>
                  </div>
                </Card>
              </li>
            ))}
          </ol>
          <Button type="button" icon={<Plus size={14} />} className="self-start" disabled={steps.length >= 20} onClick={() => (touch(), setSteps([...steps, emptyStep()]))}>
            Adicionar passo
          </Button>
        </div>
      </div>

      <div className="fixed right-0 bottom-0 left-0 z-20 border-t border-border bg-surface md:left-[230px]">
        <div className="mx-auto flex max-w-[1280px] items-center justify-end gap-2 px-4 py-3 md:px-8">
          <Button className="mr-auto" onClick={() => (dirty ? setLeaveOpen(true) : navigate('/automacoes'))}>
            Voltar
          </Button>
          <Button variant="primary" onClick={save} loading={saving} loadingText="Salvando...">
            Salvar
          </Button>
        </div>
      </div>
      <ConfirmDialog open={leaveOpen} title="Descartar mudanças?" message="O fluxo montado será perdido." confirmLabel="Descartar" danger onClose={() => setLeaveOpen(false)} onConfirm={() => navigate('/automacoes')} />
    </div>
  )
}
