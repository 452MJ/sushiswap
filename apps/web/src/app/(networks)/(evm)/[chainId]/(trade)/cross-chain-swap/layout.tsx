import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { XSWAP_SUPPORTED_CHAIN_IDS, isXSwapSupportedChainId } from 'src/config'
import { CrossChainRouteSelector } from 'src/ui/swap/cross-chain/cross-chain-route-selector'
import { ChainId } from 'sushi/chain'
import { SidebarContainer } from '~evm/_common/ui/sidebar'
import { Providers } from './providers'

export const metadata: Metadata = {
  title: 'Cross-Chain Swap',
  description:
    'Swap assets across multiple blockchains with ease using Cross-Chain Swap. Enjoy secure, seamless cross-chain swaps for a streamlined DeFi experience on Sushi.com.',
}

export default function CrossChainSwapLayout({
  children,
  params,
}: { children: React.ReactNode; params: { chainId: string } }) {
  const chainId = +params.chainId as ChainId

  if (!isXSwapSupportedChainId(chainId)) {
    return notFound()
  }

  return (
    <Providers chainId={chainId}>
      <SidebarContainer
        selectedNetwork={chainId}
        supportedNetworks={XSWAP_SUPPORTED_CHAIN_IDS}
        unsupportedNetworkHref="/ethereum/cross-chain-swap"
        shiftContent
      >
        <main className="lg:p-4 mt-16 mb-[86px] flex flex-wrap justify-center min-h-[calc(100vh-206px)]">
          {children}
          <div className="w-[480px]">
            <div className="flex-1 h-full flex items-center">
              <CrossChainRouteSelector />
            </div>
          </div>
        </main>
      </SidebarContainer>
    </Providers>
  )
}
