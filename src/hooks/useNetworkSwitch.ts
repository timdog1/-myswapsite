import { useCallback } from 'react'
import { ChainId } from '@swapr/sdk'

import { InjectedConnector } from '@web3-react/injected-connector'

import { useActiveWeb3React, useUnsupportedChainIdError } from '.'
import { NETWORK_DETAIL } from '../constants'
import { switchOrAddNetwork } from '../utils'
import { CustomNetworkConnector } from '../connectors/CustomNetworkConnector'
import { CustomWalletLinkConnector } from '../connectors/CustomWalletLinkConnector'

export type UseNetworkSwitchProps = {
  onSelectNetworkCallback?: () => void
}

export const useNetworkSwitch = ({ onSelectNetworkCallback }: UseNetworkSwitchProps = {}) => {
  const { connector, chainId, account } = useActiveWeb3React()
  const unsupportedChainIdError = useUnsupportedChainIdError()

  const selectNetwork = useCallback(
    (optionChainId?: ChainId) => {
      if (optionChainId === undefined || (optionChainId === chainId && !unsupportedChainIdError)) return
      if (!!!account && !unsupportedChainIdError && connector instanceof CustomNetworkConnector)
        connector.changeChainId(optionChainId)
      else if (!!!account && unsupportedChainIdError && connector instanceof CustomNetworkConnector)
        connector.switchUnsupportedNetwork(NETWORK_DETAIL[optionChainId])
      else if (connector instanceof InjectedConnector)
        switchOrAddNetwork(NETWORK_DETAIL[optionChainId], account || undefined)
      else if (connector instanceof CustomWalletLinkConnector)
        connector.changeChainId(NETWORK_DETAIL[optionChainId], account || undefined)

      if (onSelectNetworkCallback) onSelectNetworkCallback()
    },
    [account, chainId, connector, onSelectNetworkCallback, unsupportedChainIdError]
  )

  return {
    selectNetwork
  }
}
