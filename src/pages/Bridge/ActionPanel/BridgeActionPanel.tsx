import React, { useCallback } from 'react'
import { ChainId } from '@swapr/sdk'
import { ButtonPrimary } from '../../../components/Button'
import { useNetworkSwitch } from '../../../hooks/useNetworkSwitch'
import { BridgeStep } from '../utils'
import { NetworkSwitcher } from './NetworkSwitcher'
import { BridgeButton } from './BridgeButton'
import { networkOptionsPreset } from '../../../components/NetworkSwitcher'
import { isToken } from '../../../hooks/Tokens'
import { ButtonConfirmed, ButtonError } from '../../../components/Button'
import { AutoRow, RowBetween } from '../../../components/Row'
import Loader from '../../../components/Loader'
import ProgressSteps from '../../../components/ProgressSteps'
import Column from '../../../components/Column'
import { useBridgeActionPanel } from './useBridgeActionPanel'
import { ApprovalState } from '../../../hooks/useApproveCallback'
import { ButtonConnect } from '../../../components/ButtonConnect'

export type BridgeActionPanelProps = {
  account: string | null | undefined
  fromNetworkChainId: ChainId
  toNetworkChainId: ChainId
  isNetworkConnected: boolean
  step: BridgeStep
  setStep: (step: BridgeStep) => void
  handleModal: () => void
  handleCollect: () => void
}

export const BridgeActionPanel = ({
  step,
  account,
  handleModal,
  handleCollect,
  toNetworkChainId,
  fromNetworkChainId,
  isNetworkConnected
}: BridgeActionPanelProps) => {
  const { selectNetwork } = useNetworkSwitch()

  const {
    approvalState,
    handleApprove,
    isBalanceSufficient,
    showApprovalFlow,
    bridgeCurrency,
    isArbitrum,
    hasAmount
  } = useBridgeActionPanel()

  const handleSelectFromNetwork = useCallback(() => {
    selectNetwork(fromNetworkChainId)
  }, [fromNetworkChainId, selectNetwork])

  const handleSelectToNetwork = useCallback(() => {
    selectNetwork(toNetworkChainId)
  }, [selectNetwork, toNetworkChainId])

  const selectPanel = () => {
    // No wallet
    if (!account) {
      return <ButtonConnect />
    }

    // Change network
    if (!isNetworkConnected && step !== BridgeStep.Collect) {
      return (
        <ButtonPrimary onClick={handleSelectFromNetwork}>
          Connect to {networkOptionsPreset.find(network => network.chainId === fromNetworkChainId)?.name}
        </ButtonPrimary>
      )
    }

    //Collect
    if (step === BridgeStep.Collect) {
      return (
        <NetworkSwitcher
          sendToId={toNetworkChainId}
          onSwitchClick={handleSelectToNetwork}
          onCollectClick={handleCollect}
        />
      )
    }

    if (isBalanceSufficient) {
      const isNativeCurrency = !isToken(bridgeCurrency)

      if (isArbitrum || isNativeCurrency || (approvalState !== ApprovalState.UNKNOWN && !showApprovalFlow)) {
        return (
          <BridgeButton to={toNetworkChainId} from={fromNetworkChainId} onClick={handleModal}>
            {`Bridge to ${networkOptionsPreset.find(network => network.chainId === toNetworkChainId)?.name}`}
          </BridgeButton>
        )
      }

      if (!isNativeCurrency && approvalState !== ApprovalState.UNKNOWN) {
        return (
          <RowBetween style={{ display: 'flex', flexWrap: 'wrap' }}>
            <ButtonConfirmed
              onClick={handleApprove}
              disabled={approvalState !== ApprovalState.NOT_APPROVED}
              width="48%"
              altDisabledStyle={approvalState === ApprovalState.PENDING}
              confirmed={approvalState === ApprovalState.APPROVED}
            >
              {approvalState === ApprovalState.PENDING ? (
                <AutoRow gap="6px" justify="center">
                  Approving <Loader />
                </AutoRow>
              ) : approvalState === ApprovalState.APPROVED ? (
                'Approved'
              ) : (
                'Approve ' + bridgeCurrency?.symbol
              )}
            </ButtonConfirmed>
            <ButtonError
              onClick={handleModal}
              width="48%"
              id="swap-button"
              disabled={approvalState !== ApprovalState.APPROVED}
              error={false}
            >
              Bridge
            </ButtonError>
            <Column style={{ marginTop: '1rem', width: '100%' }}>
              <ProgressSteps steps={[approvalState === ApprovalState.APPROVED]} />
            </Column>
          </RowBetween>
        )
      }
    }
    // No Amount/Token/Balance
    return (
      <BridgeButton to={toNetworkChainId} from={fromNetworkChainId} disabled onClick={handleModal}>
        {hasAmount
          ? bridgeCurrency
            ? isBalanceSufficient
              ? `Loading...`
              : `Insufficient ${bridgeCurrency?.symbol} balance`
            : 'Select token'
          : 'Enter amount'}
      </BridgeButton>
    )
  }

  return <div style={{ marginTop: '12px' }}>{selectPanel()}</div>
}
