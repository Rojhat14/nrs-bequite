export const HOME_CATEGORY_IMAGE = '/images/editorial/categories/home-bedding.webp'
export const HOME_CATEGORY_THUMBNAIL = '/images/editorial/categories/home-bedding-thumb.webp'

export function isHomeCategory(category: { name: string; slug: string }) {
  return ['bedding', 'home', 'nevresim'].includes(category.slug.toLowerCase())
    || ['bedding', 'home', 'nevresim'].includes(category.name.toLocaleLowerCase('tr-TR'))
}

export function categoryCoverObjectKey(id: string) {
  return `category-covers/${id}/cover`
}
