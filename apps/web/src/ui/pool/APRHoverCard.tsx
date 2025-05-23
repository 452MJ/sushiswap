import {
  CardDescription,
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Separator,
} from '@sushiswap/ui'
import type { FC, ReactNode } from 'react'
import { formatPercent } from 'sushi/format'

import type {
  PoolIfIncentivized,
  PoolWithFeeAprs,
  PoolWithIncentiveApr,
} from 'sushi'

type RequiredPool = PoolIfIncentivized<PoolWithIncentiveApr<PoolWithFeeAprs>>

interface APRHoverCardProps {
  children: ReactNode
  pool: RequiredPool
  showEmissions?: boolean
}

export const APRHoverCard: FC<APRHoverCardProps> = ({ children, pool }) => {
  const feeApr1d = pool.feeApr1d

  const totalAPR = (feeApr1d + pool.incentiveApr) * 100

  const card = (
    <>
      <div className="p-6">
        <CardDescription className="mb-6 text-xs">
          APR is calculated based on the fees
          {pool.isIncentivized ? ' and rewards' : ''} generated by the pool over
          the last 24 hours. The APR displayed is algorithmic and subject to
          change.
        </CardDescription>
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-1">
            <span className="flex flex-grow text-sm text-muted-foreground">
              Fees
            </span>
            <span className="text-sm text-right">
              {formatPercent(pool.feeApr1d)}
            </span>
          </div>

          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between gap-1">
              <span className="flex flex-grow text-sm text-muted-foreground">
                Rewards
              </span>
              <span className="text-sm text-right">
                {formatPercent(pool.incentiveApr)}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Separator className="text-muted-foreground" />
          </div>
          <div className="flex items-center justify-between gap-1">
            <span className="flex flex-grow text-sm font-bold">Total APR</span>
            <span className="text-sm font-bold text-right">
              {formatPercent(totalAPR / 100)}
            </span>
          </div>
        </div>
      </div>
    </>
  )

  return (
    <>
      <div className="hidden sm:block">
        <HoverCard openDelay={300} closeDelay={0}>
          <HoverCardTrigger asChild>{children}</HoverCardTrigger>
          <HoverCardContent
            side="right"
            className="!p-0 max-w-[320px] whitespace-normal text-left"
          >
            {card}
          </HoverCardContent>
        </HoverCard>
      </div>
      <div className="block sm:hidden">
        <Popover>
          <PopoverTrigger onClick={(e) => e.stopPropagation()} asChild>
            {children}
          </PopoverTrigger>
          <PopoverContent
            side="right"
            className="!p-0 max-w-[320px] whitespace-normal text-left"
          >
            {card}
          </PopoverContent>
        </Popover>
      </div>
    </>
  )
}
