import { useState } from 'react'
import { Camera, Trash2, Upload } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Avatar } from '@/components/ui/Avatar'
import { Input } from '@/components/ui/Input'
import { supabase } from '@/lib/supabase'
import { uploadToStorageSafe } from '@/lib/storage'
import type { Profile } from '@/types/database'

interface Props {
  profile: Profile
  open: boolean
  onClose: () => void
  onSaved: () => void
}

/**
 * Modal pra editar a foto de perfil. Permite:
 *  • Fazer upload de uma nova foto (vai pro Supabase Storage)
 *  • Colar uma URL externa
 *  • Remover a foto atual
 */
export function EditarFotoPerfilModal({ profile, open, onClose, onSaved }: Props) {
  const [url, setUrl] = useState(profile.avatar_url ?? '')
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)

  async function onFileSelected(file: File | null) {
    if (!file) return
    setUploading(true)
    const u = await uploadToStorageSafe(file, `avatars/${profile.id}`, 'webdesign-assets')
    setUploading(false)
    if (u) setUrl(u)
  }

  async function salvar(novoUrl: string | null) {
    setSaving(true)
    await supabase.from('profiles').update({ avatar_url: novoUrl }).eq('id', profile.id)
    setSaving(false)
    onSaved()
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Foto do perfil"
      footer={
        <div className="flex w-full items-center justify-between gap-2">
          {profile.avatar_url && (
            <button
              onClick={() => salvar(null)}
              disabled={saving || uploading}
              className="inline-flex items-center gap-1 text-xs text-red-300 hover:underline disabled:opacity-50"
            >
              <Trash2 size={11} /> Remover foto atual
            </button>
          )}
          <div className="ml-auto flex gap-2">
            <Button variant="secondary" onClick={onClose} disabled={saving || uploading}>
              Cancelar
            </Button>
            <Button onClick={() => salvar(url || null)} disabled={saving || uploading || url === (profile.avatar_url ?? '')}>
              {saving ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Preview */}
        <div className="flex flex-col items-center gap-3 rounded-lg border border-border bg-bg-soft p-6">
          {url ? (
            <img
              src={url}
              alt={profile.nome}
              className="h-32 w-32 rounded-full border border-border object-cover"
            />
          ) : (
            <Avatar name={profile.nome} size="lg" className="!h-32 !w-32 !text-2xl" />
          )}
          <p className="text-sm font-medium text-zinc-100">{profile.nome}</p>
        </div>

        {/* Upload */}
        <label
          className={
            'flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-bg-soft px-4 py-6 text-sm text-muted transition-colors hover:border-brand-500/40 hover:text-zinc-200 ' +
            (uploading ? 'opacity-50 pointer-events-none' : '')
          }
        >
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => onFileSelected(e.target.files?.[0] ?? null)}
          />
          {uploading ? (
            <>
              <Upload size={14} className="animate-pulse" />
              Enviando...
            </>
          ) : (
            <>
              <Camera size={14} />
              Escolher arquivo do computador
            </>
          )}
        </label>

        {/* URL manual */}
        <div>
          <label className="mb-1 block text-[10px] uppercase tracking-wider text-muted">
            Ou cole uma URL de imagem
          </label>
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://..."
          />
        </div>
      </div>
    </Modal>
  )
}
