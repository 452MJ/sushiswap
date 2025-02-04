'use client'

import { createErrorToast, createToast } from '@sushiswap/notifications'
import { useCallback, useMemo, useState } from 'react'
import { erc20Abi_approve } from 'sushi/abi'
import type { Token } from 'sushi/currency'
import { type Address, UserRejectedRequestError } from 'viem'
import { usePublicClient, useSimulateContract, useWriteContract } from 'wagmi'
import type { SendTransactionReturnType } from 'wagmi/actions'
import type { ERC20ApproveABI, ERC20ApproveArgs } from './types'

interface UseTokenRevokeApproval {
  account: Address | undefined
  spender: Address
  token: Omit<Token, 'wrapped'> | undefined
}

export const useTokenRevokeApproval = ({
  account,
  spender,
  token,
}: UseTokenRevokeApproval) => {
  const [isPending, setPending] = useState(false)
  const client = usePublicClient()
  const { data: simulation } = useSimulateContract<
    ERC20ApproveABI,
    'approve',
    ERC20ApproveArgs
  >({
    address: token?.address as Address,
    abi: erc20Abi_approve,
    chainId: token?.chainId,
    functionName: 'approve',
    args: [spender, 0n],
    query: { enabled: Boolean(account && spender && token?.address) },
  })

  const onSuccess = useCallback(
    async (data: SendTransactionReturnType) => {
      if (!token) return

      setPending(true)
      try {
        const ts = new Date().getTime()
        const receiptPromise = client.waitForTransactionReceipt({
          hash: data,
        })

        void createToast({
          account,
          type: 'swap',
          chainId: token.chainId,
          txHash: data,
          promise: receiptPromise,
          summary: {
            pending: `Revoking approval for ${token.symbol}`,
            completed: `Successfully revoked approval for ${token.symbol}`,
            failed: `Failed to revoke approval for ${token.symbol}`,
          },
          timestamp: ts,
          groupTimestamp: ts,
        })

        await receiptPromise
      } finally {
        setPending(false)
      }
    },
    [token, account, client],
  )

  const onError = useCallback((e: Error) => {
    if (e instanceof Error) {
      if (!(e.cause instanceof UserRejectedRequestError)) {
        createErrorToast(e.message, true)
      }
    }
  }, [])

  const { writeContractAsync, ...rest } = useWriteContract({
    mutation: {
      onError,
      onSuccess,
    },
  })

  // biome-ignore lint/correctness/useExhaustiveDependencies: Typecheck speedup
  const write = useMemo(
    () => {
      if (!simulation?.request) return undefined

      return async () => {
        try {
          await writeContractAsync(simulation.request as any)
        } catch {}
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [simulation?.request, writeContractAsync] as const,
  )

  return {
    ...rest,
    write,
    isPending: isPending || rest.isPending,
  }
}
