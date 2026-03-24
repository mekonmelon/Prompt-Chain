export type GenericRow = Record<string, unknown>

export const FLAVOR_NAME_KEYS = ['description', 'slug', 'name', 'flavor_name', 'title'] as const
export const FLAVOR_SLUG_KEYS = ['slug'] as const
export const FLAVOR_DESCRIPTION_KEYS = ['description', 'notes', 'summary'] as const
export const FLAVOR_UPDATED_KEYS = ['modified_datetime_utc', 'updated_at', 'created_datetime_utc'] as const
export const FLAVOR_ACTIVE_KEYS = ['is_active', 'active', 'enabled'] as const
export const FLAVOR_RELATION_KEYS = ['humor_flavor_id', 'flavor_id', 'humor_flavor'] as const
export const STEP_ORDER_KEYS = ['order_by', 'step_order', 'order_index', 'order', 'sequence'] as const
export const STEP_TITLE_KEYS = ['humor_flavor_step_type_id', 'step_title', 'title', 'step_type', 'name'] as const
export const STEP_BODY_KEYS = ['description', 'step_instructions', 'step_content', 'prompt', 'content', 'instructions'] as const
export const STEP_SYSTEM_PROMPT_KEYS = ['llm_system_prompt', 'system_prompt'] as const
export const STEP_USER_PROMPT_KEYS = ['llm_user_prompt', 'user_prompt'] as const
export const STEP_INPUT_TYPE_KEYS = ['llm_input_type_id', 'input_type'] as const
export const STEP_OUTPUT_TYPE_KEYS = ['llm_output_type_id', 'output_type'] as const
export const STEP_TEMPERATURE_KEYS = ['llm_temperature', 'temperature'] as const
export const STEP_ACTIVE_KEYS = ['is_active', 'active', 'enabled'] as const
export const STEP_MODEL_KEYS = ['llm_model_id', 'model_id', 'provider_id'] as const
export const CAPTION_TEXT_KEYS = ['caption_text', 'content', 'text'] as const
export const CAPTION_FLAVOR_KEYS = ['flavor_id', 'humor_flavor_id'] as const
export const IMAGE_URL_KEYS = ['url', 'image_url', 'image_src', 'public_url'] as const

export function asText(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return JSON.stringify(value)
}

export function asNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export function getRowId(row: GenericRow) {
  return asText(row.id)
}

export function pickFirstKey(rows: GenericRow[], candidates: readonly string[]) {
  const rowWithCandidate = rows.find((row) => candidates.some((candidate) => candidate in row))
  return candidates.find((candidate) => rowWithCandidate && candidate in rowWithCandidate) ?? null
}

export function pickFirstValue(row: GenericRow | null | undefined, candidates: readonly string[]) {
  if (!row) return undefined
  for (const key of candidates) {
    if (key in row) return row[key]
  }
  return undefined
}

export function getFlavorId(row: GenericRow) {
  return asText(row.id || row.flavor_id || row.humor_flavor_id)
}

export function getFlavorSlug(row: GenericRow) {
  return asText(pickFirstValue(row, FLAVOR_SLUG_KEYS))
}

export function getFlavorName(row: GenericRow) {
  return asText(pickFirstValue(row, FLAVOR_NAME_KEYS) ?? row.id)
}

export function getFlavorDescription(row: GenericRow) {
  return asText(pickFirstValue(row, FLAVOR_DESCRIPTION_KEYS))
}

export function getStepFlavorId(row: GenericRow) {
  return asText(pickFirstValue(row, FLAVOR_RELATION_KEYS))
}

export function getStepOrder(row: GenericRow) {
  return asNumber(pickFirstValue(row, STEP_ORDER_KEYS)) ?? Number.MAX_SAFE_INTEGER
}

export function sortSteps(rows: GenericRow[]) {
  return [...rows].sort((a, b) => getStepOrder(a) - getStepOrder(b))
}

export function moveItem<T>(items: T[], fromIndex: number, toIndex: number) {
  if (fromIndex < 0 || fromIndex >= items.length || toIndex < 0 || toIndex >= items.length) {
    return [...items]
  }

  const next = [...items]
  const [item] = next.splice(fromIndex, 1)
  next.splice(toIndex, 0, item)
  return next
}

export function resequenceRows(rows: GenericRow[], orderKey: string) {
  return rows.map((row, index) => ({ ...row, [orderKey]: index + 1 }))
}

export function extractPromptVariables(rows: GenericRow[]) {
  const matches = new Set<string>()

  rows.forEach((row) => {
    Object.values(row).forEach((value) => {
      const text = asText(value)
      for (const match of text.matchAll(/\$\{([^}]+)\}/g)) {
        if (match[0]) matches.add(match[0])
      }
    })
  })

  return [...matches].sort((a, b) => a.localeCompare(b))
}

export function normalizeApiCaptions(payload: unknown) {
  const list = Array.isArray(payload)
    ? payload
    : Array.isArray((payload as { data?: unknown[] } | null)?.data)
      ? (payload as { data: unknown[] }).data
      : Array.isArray((payload as { captions?: unknown[] } | null)?.captions)
        ? (payload as { captions: unknown[] }).captions
        : []

  return list.map((item, index) => {
    const row = (item ?? {}) as GenericRow
    return {
      id: asText(row.id) || `generated-${index + 1}`,
      caption: asText(row.caption || row.caption_text || row.content || row.text),
      imageUrl: asText(row.image_url || row.url || row.public_url),
      flavorId: asText(row.flavor_id || row.humor_flavor_id),
      createdAt: asText(row.created_datetime_utc || row.created_at),
      raw: row
    }
  })
}

export function hasStudioAccess(profile: GenericRow | null | undefined) {
  return Boolean(profile?.is_superadmin || profile?.is_matrix_admin)
}

export function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function buildDuplicateSlug(existingSlugs: string[], sourceSlug: string, sourceDescription: string) {
  const base = slugify(sourceSlug || sourceDescription || 'flavor-copy') || 'flavor-copy'
  const normalizedExisting = new Set(existingSlugs.filter(Boolean))
  const initialCandidate = `${base}-copy`

  if (!normalizedExisting.has(initialCandidate)) {
    return initialCandidate
  }

  let index = 2
  while (normalizedExisting.has(`${base}-copy-${index}`)) {
    index += 1
  }

  return `${base}-copy-${index}`
}
