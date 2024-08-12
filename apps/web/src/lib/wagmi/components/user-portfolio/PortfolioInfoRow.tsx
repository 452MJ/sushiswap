import { Badge, classNames } from '@sushiswap/ui'
import { NetworkIcon } from '@sushiswap/ui/icons/NetworkIcon'
import { useRouter } from 'next/navigation'
import { FC, ReactElement } from 'react'
import { ChainId } from 'sushi/chain'

interface PortfolioInfoRow {
  id: string
  chainId: ChainId
  href?: string
  icon: ReactElement
  leftContent: ReactElement
  rightContent: ReactElement | null
}

export const PortfolioInfoRow: FC<PortfolioInfoRow> = ({
  id,
  chainId,
  icon,
  href,
  leftContent,
  rightContent,
}) => {
  const { push } = useRouter()
  return (
    <div
      id={id}
      className={classNames(
        'flex w-full items-center hover:bg-muted px-5 py-3 gap-x-6 whitespace-nowrap',
        href && 'cursor-pointer',
      )}
      onClick={() => href && push(href)}
      onKeyDown={() => href && push(href)}
    >
      <div className="shrink-0">
        <Badge
          className="border-2 border-background bg-background rounded-full z-[11]"
          position="bottom-right"
          badgeContent={
            <NetworkIcon chainId={chainId} width={14} height={14} />
          }
        >
          {icon}
        </Badge>
      </div>
      <div className="flex w-full justify-between items-center gap-x-3 overflow-hidden">
        <div className="flex flex-col gap-y-1 overflow-hidden">
          {leftContent}
        </div>
        <div className="flex-[1_0_20%] flex flex-col gap-y-1 overflow-hidden text-right">
          {rightContent}
        </div>
      </div>
    </div>
  )
}
