'use client'

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  Popover,
  PopoverContent,
  PopoverPrimitive,
} from '@sushiswap/ui'
import { NetworkIcon } from '@sushiswap/ui/icons/NetworkIcon'
import { usePathname, useRouter } from 'next/navigation'
import React, { ReactNode, useCallback, useState } from 'react'
import {
  NEW_CHAIN_IDS,
  NonStandardChainId,
  isNonStandardChainId,
} from 'src/config'
import { getNetworkName } from 'src/lib/network'
import { ChainId, isChainId, isNetworkNameKey } from 'sushi/chain'

export type NetworkSelectorOnSelectCallback<T extends number = ChainId> = (
  chainId: T,
  close: () => void,
) => void

export interface NetworkSelectorProps<
  T extends number | string = ChainId | NonStandardChainId,
> {
  networks: readonly T[]
  selected: T
  onSelect: NetworkSelectorOnSelectCallback<Extract<T, number>>
  children: ReactNode
}

const NetworkSelector = <T extends number | string>({
  onSelect,
  networks = [],
  children,
}: Omit<NetworkSelectorProps<T>, 'variant'>) => {
  const [open, setOpen] = useState(false)
  const { push } = useRouter()
  const pathname = usePathname()

  const onSelectNonStandardChainId = useCallback(
    (network: NonStandardChainId) => {
      const pathSegments = pathname.split('/')
      if (
        isNetworkNameKey(pathSegments[1]) ||
        isChainId(+pathSegments[1]) ||
        isNonStandardChainId(pathSegments[1])
      ) {
        pathSegments[1] = network
        push(pathSegments.join('/'), { scroll: false })
      } else {
        push(`/${network}/swap`, { scroll: false })
      }

      setOpen(false)
    },
    [push, pathname],
  )

  return (
    <Popover modal={true} open={open} onOpenChange={setOpen}>
      <PopoverPrimitive.Trigger asChild>{children}</PopoverPrimitive.Trigger>
      <PopoverContent className="!w-60 !p-0 !overflow-x-hidden !overflow-y-scroll scroll">
        <Command>
          <CommandInput
            testdata-id="network-selector-input"
            placeholder="Search network"
          />
          <CommandEmpty>No network found.</CommandEmpty>
          <CommandGroup>
            {networks.map((network) => {
              const name = getNetworkName(
                network as ChainId | NonStandardChainId,
              )

              return (
                <CommandItem
                  className="cursor-pointer"
                  testdata-id={`network-selector-${network}`}
                  value={`${name}__${network}`}
                  key={network}
                  onSelect={(value) => {
                    const network = value.split('__')[1]
                    if (isNonStandardChainId(network)) {
                      onSelectNonStandardChainId(network)
                    } else {
                      onSelect(+network as Extract<T, number>, () =>
                        setOpen(false),
                      )
                    }
                  }}
                >
                  <div className="flex items-center gap-2">
                    <NetworkIcon chainId={network} width={22} height={22} />
                    {name}
                    {NEW_CHAIN_IDS.includes(
                      network as (typeof NEW_CHAIN_IDS)[number],
                    ) ? (
                      <div className="text-[10px] italic rounded-full px-[6px] bg-gradient-to-r from-blue to-pink text-white font-bold">
                        NEW
                      </div>
                    ) : null}
                  </div>
                </CommandItem>
              )
            })}
          </CommandGroup>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

export { NetworkSelector }
