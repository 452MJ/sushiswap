import { Container } from '@sushiswap/ui'
import { GlobalStatsCharts } from 'src/ui/explore/global-stats-charts'
import { ChainId } from 'sushi/chain'
import { Hero } from './hero'

export const metadata = {
  title: 'Pools 💦',
}

export default async function ExploreLayout({
  children,
  params,
}: { children: React.ReactNode; params: { chainId: string } }) {
  return (
    <>
      <Container maxWidth="7xl" className="px-4 pt-20 pb-10">
        <Hero chainId={+params.chainId as ChainId} />
        <div className="mt-10">
          <GlobalStatsCharts chainId={+params.chainId as ChainId} />
        </div>
      </Container>
      <section className="flex flex-col flex-1">
        <div className="bg-gray-50 dark:bg-white/[0.02] border-t border-accent pt-4 pb-20 h-full">
          {children}
        </div>
      </section>
    </>
  )
}
