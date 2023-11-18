import type { VercelRequest, VercelResponse } from '@vercel/node'
import { z } from 'zod'
import { fetchTokensFromLists } from '../../../lib/api/v1.js'

const schema = z.object({
  chainId: z.coerce
    .number()
    .int()
    .gte(0)
    .lte(2 ** 256),
})

const handler = async (request: VercelRequest, response: VercelResponse) => {
  response.setHeader(
    'Cache-Control',
    's-maxage=900, stale-while-revalidate=86400',
  )

  const { chainId } = schema.parse(request.query)

  const tokenList = await fetchTokensFromLists(chainId)
  return response.status(200).json(tokenList)
}

export default handler
