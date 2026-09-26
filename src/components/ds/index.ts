/**
 * Design System domus.agn — ponto único de import dos componentes-base.
 *
 *   import { KPICard, DataTable, PrimaryButton, Badge, FilterBar } from '@/components/ds'
 *
 * Componentes novos (KPICard, DataTable, FilterBar, FormField, GlobalHeader,
 * PrimaryButton/OutlineButton, Badge) + reexport dos primitivos que já
 * seguem o DS (Modal, PageHeader, Sidebar, Input, Select, Textarea).
 * Guia de estilo completo: usar os tons de ./tones.
 */
export { PrimaryButton, OutlineButton } from './Button'
export { Badge } from './Badge'
export { KPICard } from './KPICard'
export { FilterBar, FilterPill, type FilterOption } from './FilterBar'
export { DataTable, ROW_TONE, type Column, type RowTone, type SortDir } from './DataTable'
export { FormField } from './FormField'
export { GlobalHeader, Wordmark } from './GlobalHeader'
export { badgeTone, textTone, hexTone, type Tone } from './tones'

// Primitivos existentes que já aderem ao design system
export { Modal } from '@/components/ui/Modal'
export { Input } from '@/components/ui/Input'
export { Select } from '@/components/ui/Select'
export { Textarea } from '@/components/ui/Textarea'
export { PageHeader } from '@/components/layout/PageHeader'
export { Sidebar } from '@/components/layout/Sidebar'
