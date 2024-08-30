'use client'

import { V2Pool, V3Pool } from '@sushiswap/graph-client/data-api'
import { FC, ReactNode, createContext, useContext, useMemo } from 'react'
import {
  getTokensFromPool,
  useTokenAmountDollarValues,
  useUnderlyingTokenBalanceFromPool,
} from 'src/lib/hooks'
import { useMasterChef } from 'src/lib/wagmi/hooks/master-chef/use-master-chef'
import { ChefType } from 'sushi'
import { ChainId } from 'sushi/chain'
import { Amount, Currency, Token } from 'sushi/currency'

interface PoolPositionStakedContext {
  balance: Amount<Token> | undefined
  value0: number
  value1: number
  underlying0: Amount<Currency> | undefined
  underlying1: Amount<Currency> | undefined
  isLoading: boolean
  isError: boolean
  isWritePending: boolean
  isWriteError: boolean
}

const Context = createContext<PoolPositionStakedContext | undefined>(undefined)

interface PoolPositionStakedProviderProps {
  pool: V2Pool | V3Pool
  children: ReactNode
  watch?: boolean
}

export const PoolPositionStakedProvider: FC<PoolPositionStakedProviderProps> =
  ({ pool, children, watch = true }) => {
    if (!pool?.incentives || pool.incentives.length === 0)
      return (
        <Context.Provider
          value={{
            balance: undefined,
            value0: 0,
            value1: 0,
            underlying0: undefined,
            underlying1: undefined,
            isLoading: false,
            isError: false,
            isWriteError: false,
            isWritePending: false,
          }}
        >
          {children}
        </Context.Provider>
      )

      // Educated guess, this is getting deprecated when we move to merkle v2, only have 3rd party rewarders running
      const incentive = pool.incentives 
      .sort((a, b) => {
        if (a.chefType === b.chefType) {
          return a.rewardPerDay > b.rewardPerDay ? -1 : 1
        }
        return a.chefType === ChefType.MasterChefV2 ? -1 : 1
      })[0]

    return (
      <_PoolPositionStakedProvider
        watch={watch}
        pool={pool}
        farmId={Number(incentive.pid)}
        chefType={incentive.chefType}
      >
        {children}
      </_PoolPositionStakedProvider>
    )
  }

interface _PoolPositionStakedProviderProps {
  pool: V2Pool | V3Pool
  children: ReactNode
  farmId: number
  chefType: ChefType
  watch: boolean
}

const _PoolPositionStakedProvider: FC<_PoolPositionStakedProviderProps> = ({
  watch,
  pool,
  farmId,
  chefType,
  children,
}) => {
  const { liquidityToken, reserve0, reserve1, totalSupply } = useMemo(() => {
    if (!pool)
      return {
        token0: undefined,
        token1: undefined,
        liquidityToken: undefined,
      }

    const { token0, token1, liquidityToken } = getTokensFromPool(pool)

    return {
      liquidityToken,
      reserve0:
        token0 && pool ? Amount.fromRawAmount(token0, pool.reserve0) : null,
      reserve1:
        token1 && pool ? Amount.fromRawAmount(token1, pool.reserve1) : null,
      totalSupply:
        liquidityToken && pool
          ? Amount.fromRawAmount(liquidityToken, pool.liquidity)
          : null,
    }
  }, [pool])

  const { balance, isLoading, isError, isWritePending, isWriteError } =
    useMasterChef({
      chainId: pool.chainId as ChainId,
      chef: chefType,
      pid: farmId,
      token: liquidityToken,
      watch,
    })

  const stakedUnderlying = useUnderlyingTokenBalanceFromPool({
    reserve0: reserve0,
    reserve1: reserve1,
    totalSupply,
    balance,
  })

  const [underlying0, underlying1] = stakedUnderlying
  const [value0, value1] = useTokenAmountDollarValues({
    chainId: pool.chainId,
    amounts: stakedUnderlying,
  })

  return (
    <Context.Provider
      value={useMemo(
        () => ({
          balance,
          value0,
          value1,
          underlying0,
          underlying1,
          isLoading,
          isError,
          isWritePending,
          isWriteError,
        }),
        [
          balance,
          isError,
          isLoading,
          isWriteError,
          isWritePending,
          underlying0,
          underlying1,
          value0,
          value1,
        ],
      )}
    >
      {children}
    </Context.Provider>
  )
}

export const usePoolPositionStaked = () => {
  const context = useContext(Context)
  if (!context) {
    throw new Error('Hook can only be used inside Pool Position Staked Context')
  }

  return context
}
