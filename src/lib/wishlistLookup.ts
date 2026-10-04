type FetchBatch = (userId: string, productIds: string[]) => Promise<string[]>

// Coalesce only the current render's reads. No retained wishlist data or shared user cache.
export function createWishlistLookup(fetchBatch: FetchBatch) {
  const pending = new Map<string, Map<string, Array<{
    resolve: (value: boolean) => void
    reject: (reason: unknown) => void
  }>>>()

  return function lookup(userId: string, productId: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      let batch = pending.get(userId)
      if (!batch) {
        batch = new Map()
        pending.set(userId, batch)
        const scheduledBatch = batch
        setTimeout(() => {
          pending.delete(userId)
          const ids = Array.from(scheduledBatch.keys())
          // Bound IN query size; all requested products are still checked.
          for (let offset = 0; offset < ids.length; offset += 100) {
            const chunk = ids.slice(offset, offset + 100)
            void (async () => {
              try {
                const favorites = new Set(await fetchBatch(userId, chunk))
                for (const id of chunk) {
                  scheduledBatch.get(id)?.forEach(waiter => waiter.resolve(favorites.has(id)))
                }
              } catch (error) {
                for (const id of chunk) scheduledBatch.get(id)?.forEach(waiter => waiter.reject(error))
              }
            })()
          }
        }, 0)
      }
      const waiters = batch.get(productId) ?? []
      waiters.push({ resolve, reject })
      batch.set(productId, waiters)
    })
  }
}
