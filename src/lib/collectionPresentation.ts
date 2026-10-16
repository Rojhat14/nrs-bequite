// Collection text is localized at the data access layer; do not replace it
// with a Turkish-only presentation override here.
export function getCollectionPresentation(collection: {
  slug: string
  name: string
  description?: string | null
}) {
  return { name: collection.name, description: collection.description }
}
