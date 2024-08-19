import { type NextRequest, NextResponse } from 'next/server'
import { chainShortNameToChainId, getChainInfo } from 'sushi/chain'

export const config = {
  matcher: [
    '/swap/:path*',
    '/:chainId/explore/:path*',
    '/:chainId/pool/:path*',
    '/:chainId/positions/:path*',
  ],
}

export async function middleware(req: NextRequest) {
  const { pathname, searchParams, search } = req.nextUrl
  if (pathname === '/swap' && search !== '') {
    const url = req.nextUrl.clone()
    if (searchParams.has('token0') && searchParams.has('token1')) {
      const token0 = searchParams.get('token0')?.toLowerCase()
      const token1 = searchParams.get('token1')?.toLowerCase()

      // Tokens cant be the same
      if (token0 === token1) {
        searchParams.delete('token0')
        searchParams.delete('token1')
        url.search = `?${searchParams.toString()}`
        return NextResponse.redirect(url)
      }
    }
  }

  if (pathname === '/cross-chain-swap' && search !== '') {
    const url = req.nextUrl.clone()
    if (searchParams.has('chainId0') && searchParams.has('chainId1')) {
      const chainId0 = searchParams.get('chainId0')?.toLowerCase()
      const chainId1 = searchParams.get('chainId1')?.toLowerCase()

      // ChainIds cant be the same
      if (chainId0 === chainId1) {
        searchParams.delete('chainId0')
        searchParams.delete('chainId1')
        searchParams.delete('token0')
        searchParams.delete('token1')
        url.search = `?${searchParams.toString()}`
        return NextResponse.redirect(url)
      }
    }
  }

  const networkNameMatch = pathname.match(
    /([\w-]+)(?=\/explore|\/pool|\/positions)/,
  )
  if (networkNameMatch?.length) {
    const { chainId, networkName } = getChainInfo(networkNameMatch[0])
    if (!chainId) return NextResponse.next()

    const url = req.nextUrl.clone()
    url.pathname = pathname.replace(networkName, chainId.toString())

    return NextResponse.rewrite(url)
  }
}
