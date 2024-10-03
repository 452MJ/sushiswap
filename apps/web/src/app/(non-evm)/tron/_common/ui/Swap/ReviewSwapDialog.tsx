import {
  SlippageToleranceStorageKey,
  useSlippageTolerance,
} from '@sushiswap/hooks'
import { DialogHeader, DialogTitle } from '@sushiswap/ui'
import { List } from '@sushiswap/ui'
import { Dialog, DialogClose, DialogContent, classNames } from '@sushiswap/ui'
import { useWallet } from '@tronweb3/tronwallet-adapter-react-hooks'
import Link from 'next/link'
import { useEffect, useMemo, useRef } from 'react'
import { formatPercent } from 'sushi/format'
import { FEE_PERCENTAGE } from '~tron/_common/constants/fee-percentage'
import { usePriceImpact } from '~tron/_common/lib/hooks/usePriceImpact'
import { useReserves } from '~tron/_common/lib/hooks/useReserves'
import { useRoutes } from '~tron/_common/lib/hooks/useRoutes'
import {
  formatUnits,
  parseUnits,
  toBigNumber,
  truncateText,
} from '~tron/_common/lib/utils/formatters'
import { getTronscanAddressLink } from '~tron/_common/lib/utils/tronscan-helpers'
import {
  warningSeverity,
  warningSeverityClassName,
} from '~tron/_common/lib/utils/warning-severity'
import { useSwapDispatch, useSwapState } from '~tron/swap/swap-provider'
import { WalletConnector } from '../WalletConnector/WalletConnector'
import { ReviewSwapDialogTrigger } from './ReviewSwapDialogTrigger'
import { SwapButton } from './SwapButton'

export const ReviewSwapDialog = () => {
  const { token0, token1, amountIn, amountOut } = useSwapState()
  const { setRoute, setPriceImpactPercentage } = useSwapDispatch()
  const closeBtnRef = useRef<HTMLButtonElement>(null)
  const { address, connected } = useWallet()
  const isConnected = address && connected
  const [slippageTolerance] = useSlippageTolerance(
    SlippageToleranceStorageKey.Swap,
  )
  const slippage =
    slippageTolerance === 'AUTO' ? 0.005 : Number(slippageTolerance) / 100

  const closeModal = () => {
    closeBtnRef?.current?.click()
  }

  const minOutput = useMemo(() => {
    if (!amountOut) return ''
    if (
      (token0?.symbol === 'WTRX' && token1?.address === 'TRON') ||
      (token0?.address === 'TRON' && token1?.symbol === 'WTRX')
    ) {
      return amountIn
    }

    const output = Number(amountOut) * (1 - slippage)
    return String(output)
  }, [amountOut, slippage, token0, token1, amountIn])

  const { data: routeData, isLoading: isLoadingRoutes } = useRoutes({
    token0,
    token1,
  })
  //these reserves are always going to be defined if a pair exists
  const { data: reserves } = useReserves({
    pairAddress: routeData?.pairs?.[0],
    token0,
    token1,
  })

  //these reserves are for is the swap needs an intermediate pair
  const { data: reserves1 } = useReserves({
    pairAddress: routeData?.pairs?.[1],
    token0,
    token1,
  })

  //this number is always going to be defined if the reserves exists
  const { data: priceImpactPercentage0 } = usePriceImpact({
    amount: amountIn,
    token: token0,
    reserves,
  })

  //this number is for the price impact of the second pair in a hop is needed
  const { data: priceImpactPercentage1 } = usePriceImpact({
    amount: amountOut,
    token: token1,
    reserves: reserves1,
  })

  const networkFee = useMemo(() => {
    const amountInWei = parseUnits(amountIn, token0?.decimals)
    const feeInWei = toBigNumber(amountInWei).multipliedBy(FEE_PERCENTAGE)
    return { feeInToken: feeInWei.toString() }
  }, [amountIn, token0])

  const _priceImpactPercentage =
    (priceImpactPercentage0 ?? 0) + (priceImpactPercentage1 ?? 0)
  const priceImpactPercentage =
    _priceImpactPercentage > 100 ? 100 : _priceImpactPercentage

  useEffect(() => {
    if (isLoadingRoutes) {
      setRoute([])
    }
    if (routeData && routeData.route.length > 0 && !isLoadingRoutes) {
      setRoute(routeData.route)
    }
  }, [routeData, isLoadingRoutes, setRoute])

  useEffect(() => {
    setPriceImpactPercentage(priceImpactPercentage ?? 0)
  }, [priceImpactPercentage, setPriceImpactPercentage])

  const severityClass = useMemo(() => {
    return warningSeverityClassName(warningSeverity(priceImpactPercentage))
  }, [priceImpactPercentage])

  return (
    <Dialog>
      <div className="pt-4">
        {isConnected ? (
          <ReviewSwapDialogTrigger />
        ) : (
          <WalletConnector variant="default" fullWidth size="xl" />
        )}
      </div>
      <DialogContent>
        <div className="max-w-[504px] mx-auto">
          <DialogHeader>
            <DialogTitle>
              <div className="flex justify-between gap-4">
                <div className="flex flex-col flex-grow">
                  <h1 className="text-lg font-semibold dark:text-slate-50">
                    Buy {amountOut} {token1?.symbol}
                  </h1>
                  <h1 className="text-gray-500 text-sm font-medium dark:text-slate-300">
                    Sell {amountIn} {token0?.symbol}
                  </h1>
                </div>
              </div>
            </DialogTitle>
            <DialogClose ref={closeBtnRef} />
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <List>
              <List.Control>
                <List.KeyValue title="Network">TRON</List.KeyValue>
                <List.KeyValue
                  title="Price Impact"
                  subtitle="The impact your trade has on the market price of this pool."
                >
                  <span
                    style={{ color: severityClass }}
                    className={classNames(
                      'text-gray-700 text-right dark:text-slate-400',
                    )}
                  >
                    -{formatPercent(priceImpactPercentage / 100)}
                  </span>
                </List.KeyValue>
                <List.KeyValue
                  title={`Min. received after slippage (${
                    slippageTolerance === 'AUTO' ? '0.5' : slippageTolerance
                  }%)`}
                  subtitle="The minimum amount you are guaranteed to receive."
                >
                  {minOutput} {token1?.symbol}
                </List.KeyValue>

                <List.KeyValue title="Network fee">
                  {formatUnits(networkFee?.feeInToken, token0?.decimals, 6)}{' '}
                  {token0?.symbol}
                </List.KeyValue>
              </List.Control>

              {address && (
                <List className="!pt-2">
                  <List.Control>
                    <List.KeyValue title="Recipient">
                      <Link
                        target="_blank"
                        href={getTronscanAddressLink(address)}
                        className={classNames(
                          'flex items-center gap-2 cursor-pointer text-blue',
                        )}
                        rel="noreferrer"
                      >
                        {truncateText(address)}
                      </Link>
                    </List.KeyValue>
                  </List.Control>
                </List>
              )}
            </List>
          </div>
          <div className="pt-4 space-y-4">
            <SwapButton closeModal={closeModal} minOutput={minOutput} />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
