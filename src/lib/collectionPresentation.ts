// Keep catalog identifiers and URLs intact while updating public collection copy.
export function getCollectionPresentation(collection: {
  slug: string
  name: string
  description?: string | null
}) {
  if (collection.slug === 'davet') {
    return {
      name: 'Tesettür',
      description: 'Tesettür stiline eşlik eden zarif siluetler ve özenle seçilmiş parçalar.',
    }
  }
  return { name: collection.name, description: collection.description }
}
