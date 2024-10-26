import { getAcademyArticles } from '@sushiswap/graph-client/strapi'
import type { MetadataRoute } from 'next'

export const revalidate = 0

const products = ['bentobox', 'furo', 'onsen', 'sushixswap']

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  try {
    const { articles } = await getAcademyArticles({
      pagination: { pageSize: 10000 },
    })

    return [
      {
        url: 'https://sushi.com/academy',
        lastModified: new Date(),
        changeFrequency: 'yearly',
      },
      {
        url: 'https://sushi.com/academy/explore',
        lastModified: new Date(),
        changeFrequency: 'yearly',
      },
      ...products.map(
        (product) =>
          ({
            url: `https://sushi.com/academy/products/${product}`,
            lastModified: new Date(),
            changeFrequency: 'yearly',
          }) as const,
      ),
      ...articles.map(
        (article) =>
          ({
            url: `https://sushi.com/academy/${article.slug}`,
            lastModified: new Date(article.updatedAt),
            changeFrequency: 'weekly',
          }) as const,
      ),
    ]
  } catch {
    console.error('sitemap: Error fetching academy articles')
    return []
  }
}
