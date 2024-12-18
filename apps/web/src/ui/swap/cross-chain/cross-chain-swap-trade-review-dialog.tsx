'use client'

import {
  createErrorToast,
  createInfoToast,
  createToast,
} from '@sushiswap/notifications'
import {
  BrowserEvent,
  InterfaceElementName,
  SwapEventName,
  TraceEvent,
  sendAnalyticsEvent,
  useTrace,
} from '@sushiswap/telemetry'
import {
  DialogClose,
  DialogContent,
  DialogCustom,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogProvider,
  DialogReview,
  DialogTitle,
  DialogType,
  Message,
} from '@sushiswap/ui'
import { Collapsible } from '@sushiswap/ui'
import { Button } from '@sushiswap/ui'
import { Dots } from '@sushiswap/ui'
import { List } from '@sushiswap/ui'
import { SkeletonText } from '@sushiswap/ui'
import { nanoid } from 'nanoid'
import React, {
  FC,
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { isXSwapSupportedChainId } from 'src/config'
import { APPROVE_TAG_XSWAP } from 'src/lib/constants'
import { useCrossChainTradeStep } from 'src/lib/hooks/react-query'
import { useSlippageTolerance } from 'src/lib/hooks/useSlippageTolerance'
import {
  getCrossChainFeesBreakdown,
  useLiFiStatus,
} from 'src/lib/swap/cross-chain'
import { warningSeverity } from 'src/lib/swap/warningSeverity'
import { useApproved } from 'src/lib/wagmi/systems/Checker/Provider'
import { Chain, ChainKey, chainName } from 'sushi/chain'
import { Native } from 'sushi/currency'
import { formatNumber, formatUSD, shortenAddress } from 'sushi/format'
import { ZERO } from 'sushi/math'
import {
  SendTransactionReturnType,
  UserRejectedRequestError,
  stringify,
} from 'viem'
import {
  useAccount,
  useEstimateGas,
  usePublicClient,
  useSendTransaction,
  useTransaction,
} from 'wagmi'
import { useRefetchBalances } from '~evm/_common/ui/balance-provider/use-refetch-balances'
import {
  ConfirmationDialogContent,
  Divider,
  GetStateComponent,
  StepState,
  failedState,
  finishedState,
} from './cross-chain-swap-confirmation-dialog'
import { CrossChainSwapTradeReviewRoute } from './cross-chain-swap-trade-review-route'
import {
  UseSelectedCrossChainTradeRouteReturn,
  useDerivedStateCrossChainSwap,
  useSelectedCrossChainTradeRoute,
} from './derivedstate-cross-chain-swap-provider'

export const CrossChainSwapTradeReviewDialog: FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [slippagePercent] = useSlippageTolerance()
  const { address, chain } = useAccount()
  const {
    mutate: { setTradeId, setSwapAmount },
    state: {
      recipient,
      swapAmount,
      swapAmountString,
      chainId0,
      token0,
      token1,
      chainId1,
      tradeId,
    },
  } = useDerivedStateCrossChainSwap()
  const client0 = usePublicClient({ chainId: chainId0 })
  const client1 = usePublicClient({ chainId: chainId1 })
  const { approved } = useApproved(APPROVE_TAG_XSWAP)
  const { data: selectedRoute } = useSelectedCrossChainTradeRoute()
  const {
    data: step,
    isFetching,
    isError: isStepQueryError,
  } = useCrossChainTradeStep({
    step: selectedRoute?.steps?.[0],
    query: {
      enabled: Boolean(approved && address),
    },
  })

  const groupTs = useRef<number>()
  const { refetchChain: refetchBalances } = useRefetchBalances()

  const [stepStates, setStepStates] = useState<{
    source: StepState
    bridge: StepState
    dest: StepState
  }>({
    source: StepState.Success,
    bridge: StepState.Success,
    dest: StepState.Success,
  })

  const routeRef = useRef<UseSelectedCrossChainTradeRouteReturn | null>(null)

  const {
    data: estGas,
    isError: isEstGasError,
    error: estGasError,
  } = useEstimateGas({
    chainId: chainId0,
    to: step?.transactionRequest?.to,
    data: step?.transactionRequest?.data,
    value: step?.transactionRequest?.value,
    account: step?.transactionRequest?.from,
    query: {
      enabled: Boolean(
        isXSwapSupportedChainId(chainId0) &&
          isXSwapSupportedChainId(chainId1) &&
          chain?.id === chainId0 &&
          approved,
      ),
    },
  })

  const preparedTx = useMemo(() => {
    return step?.transactionRequest && estGas
      ? { ...step.transactionRequest, gas: estGas }
      : undefined
  }, [step?.transactionRequest, estGas])

  // onSimulateError
  useEffect(() => {
    if (estGasError) {
      console.error('cross chain swap prepare error', estGasError)
      if (estGasError.message.startsWith('user rejected transaction')) return

      sendAnalyticsEvent(SwapEventName.XSWAP_ESTIMATE_GAS_CALL_FAILED, {
        error: estGasError.message,
      })
    }
  }, [estGasError])

  const trace = useTrace()

  const onWriteSuccess = useCallback(
    async (hash: SendTransactionReturnType) => {
      setStepStates({
        source: StepState.Pending,
        bridge: StepState.NotStarted,
        dest: StepState.NotStarted,
      })

      setSwapAmount('')

      if (!routeRef?.current || !chainId0) return

      sendAnalyticsEvent(SwapEventName.XSWAP_SIGNED, {
        ...trace,
        txHash: hash,
      })

      const receiptPromise = client0.waitForTransactionReceipt({ hash })

      groupTs.current = new Date().getTime()
      void createToast({
        account: address,
        type: 'swap',
        chainId: chainId0,
        txHash: hash,
        promise: receiptPromise,
        summary:
          routeRef?.current?.steps?.[0]?.includedSteps?.[0]?.type === 'cross'
            ? {
                pending: `Sending ${routeRef?.current?.amountIn?.toSignificant(
                  6,
                )} ${routeRef?.current?.amountIn?.currency.symbol} to ${
                  Chain.fromChainId(routeRef?.current?.toChainId)?.name
                }`,
                completed: `Sent ${routeRef?.current?.amountIn?.toSignificant(
                  6,
                )} ${routeRef?.current?.amountIn?.currency.symbol} to ${
                  Chain.fromChainId(routeRef?.current?.toChainId)?.name
                }`,
                failed: `Something went wrong when trying to send ${
                  routeRef?.current?.amountIn?.currency.symbol
                } to ${Chain.fromChainId(routeRef?.current?.toChainId)?.name}`,
              }
            : {
                pending: `Swapping ${routeRef.current?.amountIn?.toSignificant(
                  6,
                )} ${
                  routeRef?.current?.amountIn?.currency.symbol
                } to bridge token ${
                  routeRef?.current?.steps?.[0]?.includedSteps?.[0]?.action
                    .toToken.symbol
                }`,
                completed: `Swapped ${routeRef?.current?.amountIn?.toSignificant(
                  6,
                )} ${
                  routeRef?.current?.amountIn?.currency.symbol
                } to bridge token ${
                  routeRef?.current?.steps?.[0]?.includedSteps?.[0]?.action
                    .toToken.symbol
                }`,
                failed: `Something went wrong when trying to swap ${routeRef?.current?.amountIn?.currency.symbol} to bridge token`,
              },
        timestamp: groupTs.current,
        groupTimestamp: groupTs.current,
      })

      try {
        const receipt = await receiptPromise
        const trade = routeRef.current
        if (receipt.status === 'success') {
          sendAnalyticsEvent(SwapEventName.XSWAP_SRC_TRANSACTION_COMPLETED, {
            txHash: hash,
            address: receipt.from,
            src_chain_id: trade?.amountIn?.currency?.chainId,
            dst_chain_id: trade?.amountOut?.currency?.chainId,
          })
        } else {
          sendAnalyticsEvent(SwapEventName.XSWAP_SRC_TRANSACTION_FAILED, {
            txHash: hash,
            address: receipt.from,
            src_chain_id: trade?.amountIn?.currency?.chainId,
            dst_chain_id: trade?.amountOut?.currency?.chainId,
          })

          setStepStates({
            source: StepState.Failed,
            bridge: StepState.NotStarted,
            dest: StepState.NotStarted,
          })
        }

        setStepStates({
          source: StepState.Success,
          bridge: StepState.Pending,
          dest: StepState.NotStarted,
        })
      } catch {
        setStepStates({
          source: StepState.Failed,
          bridge: StepState.NotStarted,
          dest: StepState.NotStarted,
        })
      } finally {
        refetchBalances(chainId0)
        setTradeId(nanoid())
      }
    },
    [
      trace,
      setSwapAmount,
      chainId0,
      client0,
      address,
      refetchBalances,
      setTradeId,
    ],
  )

  const onWriteError = useCallback((e: Error) => {
    setStepStates({
      source: StepState.Failed,
      bridge: StepState.NotStarted,
      dest: StepState.NotStarted,
    })

    if (e.cause instanceof UserRejectedRequestError) {
      return
    }

    createErrorToast(e.message, false)

    sendAnalyticsEvent(SwapEventName.XSWAP_ERROR, {
      error: e instanceof Error ? e.message : undefined,
    })
  }, [])

  const {
    sendTransactionAsync,
    isPending: isWritePending,
    data: hash,
    reset,
  } = useSendTransaction({
    mutation: {
      onSuccess: onWriteSuccess,
      onError: onWriteError,
      onMutate: () => {
        if (routeRef && selectedRoute) {
          routeRef.current = selectedRoute
        }
      },
    },
  })

  const write = useMemo(() => {
    if (!preparedTx) return undefined

    return async (confirm: () => void) => {
      setStepStates({
        source: StepState.Sign,
        bridge: StepState.NotStarted,
        dest: StepState.NotStarted,
      })

      confirm()
      try {
        await sendTransactionAsync(preparedTx)
      } catch {}
    }
  }, [sendTransactionAsync, preparedTx])

  const { data: lifiData } = useLiFiStatus({
    tradeId: tradeId,
    txHash: hash,
  })

  const { data: receipt } = useTransaction({
    chainId: chainId1,
    hash: lifiData?.receiving?.txHash,
    query: {
      enabled: Boolean(lifiData?.receiving?.txHash),
    },
  })

  useEffect(() => {
    if (lifiData?.status === 'DONE') {
      if (lifiData?.substatus === 'COMPLETED') {
        setStepStates({
          source: StepState.Success,
          bridge: StepState.Success,
          dest: StepState.Success,
        })
      }
      if (lifiData?.substatus === 'PARTIAL') {
        setStepStates({
          source: StepState.Success,
          bridge: StepState.Success,
          dest: StepState.PartialSuccess,
        })
      }
    }
  }, [lifiData])

  // biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
  useEffect(() => {
    if (
      lifiData?.lifiExplorerLink &&
      groupTs.current &&
      stepStates.source === StepState.Success
    ) {
      void createInfoToast({
        account: address,
        type: 'xswap',
        chainId: chainId0,
        href: lifiData.lifiExplorerLink,
        summary: `Bridging ${routeRef?.current?.fromToken?.symbol} from ${
          Chain.from(chainId0)?.name
        } to ${Chain.from(chainId1)?.name}`,
        timestamp: new Date().getTime(),
        groupTimestamp: groupTs.current,
      })
    }
  }, [lifiData?.lifiExplorerLink])

  // biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
  useEffect(() => {
    if (receipt?.hash && groupTs.current) {
      void createToast({
        account: address,
        type: 'swap',
        chainId: chainId1,
        txHash: receipt.hash,
        promise: client1
          .waitForTransactionReceipt({
            hash: receipt.hash,
          })
          .catch((e) => {
            sendAnalyticsEvent(SwapEventName.XSWAP_DST_TRANSACTION_FAILED, {
              chain_id: chainId1,
              txHash: receipt.hash,
              error: e instanceof Error ? e.message : undefined,
            })
            throw e
          })
          .then(() => {
            sendAnalyticsEvent(SwapEventName.XSWAP_DST_TRANSACTION_COMPLETED, {
              chain_id: chainId1,
              txHash: lifiData?.receiving?.txHash,
            })
            refetchBalances(chainId1)
          })
          .then(reset),
        summary:
          routeRef?.current?.steps?.[0]?.includedSteps?.[1]?.type === 'swap' ||
          routeRef?.current?.steps?.[0]?.includedSteps?.[2]?.type === 'swap'
            ? {
                pending: `Swapping ${
                  routeRef?.current?.steps?.[0]?.includedSteps[2]?.action
                    .fromToken?.symbol
                } to ${routeRef?.current?.amountOut?.toSignificant(6)} ${
                  routeRef?.current?.amountOut?.currency.symbol
                }`,
                completed: `Swapped ${
                  routeRef?.current?.steps?.[0]?.includedSteps[2]?.action
                    .fromToken?.symbol
                } to ${routeRef?.current?.amountOut?.toSignificant(6)} ${
                  routeRef?.current?.amountOut?.currency.symbol
                }`,
                failed: `Something went wrong when trying to swap ${
                  routeRef?.current?.steps?.[0]?.includedSteps[2]?.action
                    .fromToken?.symbol
                } to ${routeRef?.current?.amountOut?.toSignificant(6)} ${
                  routeRef?.current?.amountOut?.currency.symbol
                }`,
              }
            : {
                pending: `Receiving ${routeRef?.current?.amountOut?.toSignificant(
                  6,
                )} ${routeRef?.current?.amountOut?.currency.symbol} on ${
                  Chain.fromChainId(routeRef?.current?.toChainId!)?.name
                }`,
                completed: `Received ${routeRef?.current?.amountOut?.toSignificant(
                  6,
                )} ${routeRef?.current?.amountOut?.currency.symbol} on ${
                  Chain.fromChainId(routeRef?.current?.toChainId!)?.name
                }`,
                failed: `Something went wrong when trying to receive ${routeRef?.current?.amountOut?.toSignificant(
                  6,
                )} ${routeRef?.current?.amountOut?.currency.symbol} on ${
                  Chain.fromChainId(routeRef?.current?.toChainId!)?.name
                }`,
              },
        timestamp: new Date().getTime(),
        groupTimestamp: groupTs.current,
      })
    }
  }, [receipt?.hash])

  const feeData = useMemo(
    () => (step ? getCrossChainFeesBreakdown([step]) : undefined),
    [step],
  )

  return (
    <DialogProvider>
      <DialogReview>
        {({ confirm }) => (
          <>
            <div className="flex flex-col">
              <Collapsible
                open={Boolean(
                  +swapAmountString > 0 &&
                    stringify(estGasError).includes('insufficient funds'),
                )}
              >
                <div className="pt-4">
                  <Message size="sm" variant="destructive">
                    Insufficient {Native.onChain(chainId0).symbol} balance on{' '}
                    {Chain.fromChainId(chainId0)?.name} to cover the network
                    fee. Please lower your input amount or{' '}
                    <a
                      href={`/${ChainKey[chainId0]}/swap?token1=NATIVE`}
                      className="underline decoration-dotted underline-offset-2"
                    >
                      swap for more {Native.onChain(chainId0).symbol}
                    </a>
                    .
                  </Message>
                </div>
              </Collapsible>
              <div className="mt-4">{children}</div>
            </div>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {isFetching ? (
                    <SkeletonText fontSize="xs" className="w-2/3" />
                  ) : (
                    `Receive ${step?.amountOut?.toSignificant(6)} ${
                      token1?.symbol
                    }`
                  )}
                </DialogTitle>
                <DialogDescription>
                  Swap {swapAmount?.toSignificant(6)} {token0?.symbol}{' '}
                </DialogDescription>
              </DialogHeader>
              <div className="flex flex-col gap-4 overflow-x-hidden">
                <List>
                  <List.Control>
                    <List.KeyValue title="Network">
                      <div className="justify-end w-full gap-1 truncate whitespace-nowrap">
                        {chainName?.[chainId0]
                          ?.replace('Mainnet Shard 0', '')
                          ?.replace('Mainnet', '')
                          ?.trim()}
                        <br />
                        <span className="text-gray-400 dark:text-slate-500">
                          to
                        </span>{' '}
                        {chainName?.[chainId1]
                          ?.replace('Mainnet Shard 0', '')
                          ?.replace('Mainnet', '')
                          ?.trim()}
                      </div>
                    </List.KeyValue>
                    <List.KeyValue
                      title="Price impact"
                      subtitle="The impact your trade has on the market price of this pool."
                    >
                      {isFetching || !step?.priceImpact ? (
                        <SkeletonText
                          align="right"
                          fontSize="sm"
                          className="w-1/5"
                        />
                      ) : (
                        `${
                          step.priceImpact.lessThan(ZERO)
                            ? '+'
                            : step.priceImpact.greaterThan(ZERO)
                              ? '-'
                              : ''
                        }${Math.abs(Number(step.priceImpact.toFixed(2)))}%`
                      )}
                    </List.KeyValue>
                    <List.KeyValue
                      title="Est. received"
                      subtitle="The estimated output amount."
                    >
                      {isFetching || !step?.amountOut ? (
                        <SkeletonText
                          align="right"
                          fontSize="sm"
                          className="w-1/2"
                        />
                      ) : (
                        `${step.amountOut.toSignificant(6)} ${token1?.symbol}`
                      )}
                    </List.KeyValue>
                    <List.KeyValue
                      title={`Min. received after slippage (${slippagePercent.toPercentageString()})`}
                      subtitle="The minimum amount you are guaranteed to receive."
                    >
                      {isFetching || !step?.amountOutMin ? (
                        <SkeletonText
                          align="right"
                          fontSize="sm"
                          className="w-1/2"
                        />
                      ) : (
                        `${step.amountOutMin?.toSignificant(6)} ${
                          token1?.symbol
                        }`
                      )}
                    </List.KeyValue>
                    {feeData && feeData.feesBreakdown.gas.size > 0 ? (
                      <List.KeyValue
                        title="Network fee"
                        subtitle="The transaction fee charged by the origin blockchain."
                      >
                        <div className="flex flex-col gap-1">
                          {feeData.feesBreakdown.gas.get(chainId0) ? (
                            <span>
                              {formatNumber(
                                feeData.feesBreakdown.gas
                                  .get(chainId0)!
                                  .amount.toExact(),
                              )}{' '}
                              {
                                feeData.feesBreakdown.gas.get(chainId0)!.amount
                                  .currency.symbol
                              }{' '}
                              <span className="text-muted-foreground">
                                (
                                {formatUSD(
                                  feeData.feesBreakdown.gas.get(chainId0)!
                                    .amountUSD,
                                )}
                                )
                              </span>
                            </span>
                          ) : null}
                          {feeData.feesBreakdown.gas.get(chainId1) ? (
                            <span>
                              {formatNumber(
                                feeData.feesBreakdown.gas
                                  .get(chainId1)!
                                  .amount.toExact(),
                              )}{' '}
                              {
                                feeData.feesBreakdown.gas.get(chainId1)!.amount
                                  .currency.symbol
                              }{' '}
                              <span className="text-muted-foreground">
                                (
                                {formatUSD(
                                  feeData.feesBreakdown.gas.get(chainId1)!
                                    .amountUSD,
                                )}
                              </span>
                              )
                            </span>
                          ) : null}
                        </div>
                      </List.KeyValue>
                    ) : null}
                    {feeData && feeData.feesBreakdown.protocol.size > 0 ? (
                      <List.KeyValue
                        title="Protocol fee"
                        subtitle="The fee  charged by the bridge provider."
                      >
                        {feeData ? (
                          <div className="flex flex-col gap-1">
                            {feeData.feesBreakdown.protocol.get(chainId0) ? (
                              <span>
                                {formatNumber(
                                  feeData.feesBreakdown.protocol
                                    .get(chainId0)!
                                    .amount.toExact(),
                                )}{' '}
                                {
                                  feeData.feesBreakdown.protocol.get(chainId0)!
                                    .amount.currency.symbol
                                }{' '}
                                <span className="text-muted-foreground">
                                  (
                                  {formatUSD(
                                    feeData.feesBreakdown.protocol.get(
                                      chainId0,
                                    )!.amountUSD,
                                  )}
                                  )
                                </span>
                              </span>
                            ) : null}
                            {feeData.feesBreakdown.protocol.get(chainId1) ? (
                              <span>
                                {formatNumber(
                                  feeData.feesBreakdown.protocol
                                    .get(chainId1)!
                                    .amount.toExact(),
                                )}{' '}
                                {
                                  feeData.feesBreakdown.protocol.get(chainId1)!
                                    .amount.currency.symbol
                                }{' '}
                                <span className="text-muted-foreground">
                                  (
                                  {formatUSD(
                                    feeData.feesBreakdown.protocol.get(
                                      chainId1,
                                    )!.amountUSD,
                                  )}
                                  )
                                </span>
                              </span>
                            ) : null}
                          </div>
                        ) : null}
                      </List.KeyValue>
                    ) : null}
                  </List.Control>
                </List>
                <List className="!pt-2">
                  <List.Control>
                    <CrossChainSwapTradeReviewRoute />
                  </List.Control>
                </List>
                {recipient && (
                  <List className="!pt-2">
                    <List.Control>
                      <List.KeyValue title="Recipient">
                        <a
                          target="_blank"
                          href={Chain.accountUrl(chainId0, recipient) ?? '#'}
                          className="flex items-center gap-2 cursor-pointer text-blue"
                          rel="noreferrer"
                        >
                          {shortenAddress(recipient)}
                        </a>
                      </List.KeyValue>
                    </List.Control>
                  </List>
                )}
              </div>
              <DialogFooter>
                <TraceEvent
                  events={[BrowserEvent.onClick]}
                  element={InterfaceElementName.CONFIRM_SWAP_BUTTON}
                  name={SwapEventName.XSWAP_SUBMITTED_BUTTON_CLICKED}
                  properties={{
                    ...trace,
                  }}
                >
                  <Button
                    fullWidth
                    size="xl"
                    loading={!write && !isEstGasError && !isStepQueryError}
                    onClick={() => write?.(confirm)}
                    disabled={
                      isWritePending ||
                      Boolean(!write && +swapAmountString > 0) ||
                      isEstGasError ||
                      isStepQueryError
                    }
                    color={
                      isEstGasError || isStepQueryError
                        ? 'red'
                        : warningSeverity(step?.priceImpact) >= 3
                          ? 'red'
                          : 'blue'
                    }
                    testId="confirm-swap"
                  >
                    {isEstGasError || isStepQueryError ? (
                      'Shoot! Something went wrong :('
                    ) : isWritePending ? (
                      <Dots>Confirm Swap</Dots>
                    ) : (
                      `Swap ${token0?.symbol} for ${token1?.symbol}`
                    )}
                  </Button>
                </TraceEvent>
              </DialogFooter>
            </DialogContent>
          </>
        )}
      </DialogReview>
      <DialogCustom dialogType={DialogType.Confirm}>
        <DialogContent onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>Cross-chain swap</DialogTitle>
            <DialogDescription asChild>
              <div>
                <ConfirmationDialogContent
                  dialogState={stepStates}
                  bridgeUrl={lifiData?.lifiExplorerLink}
                  txHash={hash}
                  dstTxHash={lifiData?.receiving?.txHash}
                  routeRef={routeRef}
                />
              </div>
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center justify-center gap-4">
            <div className="py-5">
              <div className="relative flex gap-3">
                <GetStateComponent index={1} state={stepStates.source} />
                <Divider />
                <GetStateComponent index={2} state={stepStates.bridge} />
                <Divider />
                <GetStateComponent index={3} state={stepStates.dest} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button size="xl" fullWidth id="swap-dialog-close">
                {failedState(stepStates)
                  ? 'Try again'
                  : finishedState(stepStates)
                    ? 'Make another swap'
                    : 'Close'}
              </Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </DialogCustom>
    </DialogProvider>
  )
}
