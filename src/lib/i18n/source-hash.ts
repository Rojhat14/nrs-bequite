import 'server-only'
import { createHash } from 'node:crypto'

export function sourceHash(parts: Array<string | null | undefined>) {
  const source = JSON.stringify(parts.map(value => (value ?? '').normalize('NFC')))
  return createHash('sha256').update(source, 'utf8').digest('hex')
}

export function productSourceHash(product: { name: string; description?: string | null; fabric?: string | null; care?: string | null }) {
  return sourceHash([product.name, product.description, product.fabric, product.care])
}
