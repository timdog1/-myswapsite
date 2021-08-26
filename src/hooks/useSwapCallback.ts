import { BigNumber } from '@ethersproject/bignumber'
import { TransactionRequest } from '@ethersproject/abstract-provider'
import { ChainId, UniswapV2RoutablePlatform, Trade } from '@swapr/sdk'
import { useEffect, useMemo, useState } from 'react'
import { INITIAL_ALLOWED_SLIPPAGE } from '../constants'
import { useTransactionAdder } from '../state/transactions/hooks'
import { calculateGasMargin, getSigner, isAddress, shortenAddress } from '../utils'
import { useActiveWeb3React } from './index'
import useTransactionDeadline from './useTransactionDeadline'
import useENS from './useENS'
import { useMainnetGasPrices } from '../state/application/hooks'
import { useUserPreferredGasPrice } from '../state/user/hooks'
import { MainnetGasPrice } from '../state/application/actions'
import { UnsignedTransaction } from 'ethers'

export enum SwapCallbackState {
  INVALID,
  LOADING,
  VALID
}

interface SuccessfulCall {
  transaction: UnsignedTransaction
  gasEstimate: BigNumber
}

interface FailedCall {
  transaction: UnsignedTransaction
  error: Error
}

type EstimatedSwapCall = SuccessfulCall | FailedCall

/**
 * Returns the swap calls that can be used to make the trade
 * @param trade trade to execute
 * @param allowedSlippage user allowed slippage
 * @param recipientAddressOrName
 */
export function useSwapsTransactions(
  trades: Trade[] | undefined, // trade to execute, required
  allowedSlippage: number = INITIAL_ALLOWED_SLIPPAGE, // in bips
  recipientAddressOrName: string | null // the ENS name or address of the recipient of the trade, or null if swap should be returned to sender
): UnsignedTransaction[] {
  const { account, chainId, library } = useActiveWeb3React()
  const { address: recipientAddress } = useENS(recipientAddressOrName)
  const recipient = recipientAddressOrName === null ? account : recipientAddress
  const deadline = useTransactionDeadline()
  const [transactions, setTransactions] = useState<UnsignedTransaction[]>([])

  useEffect(() => {
    const fetchTransactions = async () => {
      if (!trades || trades.length === 0 || !recipient || !library || !account || !chainId || !deadline) {
        setTransactions([])
        return
      }
      setTransactions(
        await Promise.all(
          trades.map(async trade => {
            return trade.swapTransaction({
              recipient,
              ttl: deadline.toNumber()
            })
          })
        )
      )
    }
    fetchTransactions()
  }, [account, allowedSlippage, chainId, deadline, library, recipient, trades])

  return transactions
}

// returns a function that will execute a swap, if the parameters are all valid
// and the user has approved the slippage adjusted input amount for the trade
export function useSwapCallback(
  trade: Trade | undefined, // trade to execute, required
  allowedSlippage: number = INITIAL_ALLOWED_SLIPPAGE, // in bips
  recipientAddressOrName: string | null // the ENS name or address of the recipient of the trade, or null if swap should be returned to sender
): { state: SwapCallbackState; callback: null | (() => Promise<string>); error: string | null } {
  const { account, chainId, library } = useActiveWeb3React()
  const mainnetGasPrices = useMainnetGasPrices()
  const [preferredGasPrice] = useUserPreferredGasPrice()

  const memoizedTrades = useMemo(() => (trade ? [trade] : undefined), [trade])
  const swapTransactions = useSwapsTransactions(memoizedTrades, allowedSlippage, recipientAddressOrName)

  const addTransaction = useTransactionAdder()

  const { address: recipientAddress } = useENS(recipientAddressOrName)
  const recipient = recipientAddressOrName === null ? account : recipientAddress

  return useMemo(() => {
    if (!trade || !library || !account || !chainId) {
      return { state: SwapCallbackState.INVALID, callback: null, error: 'Missing dependencies' }
    }
    if (!recipient) {
      if (recipientAddressOrName !== null) {
        return { state: SwapCallbackState.INVALID, callback: null, error: 'Invalid recipient' }
      } else {
        return { state: SwapCallbackState.LOADING, callback: null, error: null }
      }
    }

    return {
      state: SwapCallbackState.VALID,
      callback: async function onSwap(): Promise<string> {
        const estimatedCalls: EstimatedSwapCall[] = await Promise.all(
          swapTransactions.map(transaction => {
            if (chainId === ChainId.XDAI) {
              transaction.gasLimit = BigNumber.from('1000000')
            }
            const estimableTransaction = { ...transaction, type: undefined, from: account }
            return library
              .estimateGas(estimableTransaction)
              .then(gasEstimate => {
                return {
                  transaction,
                  gasEstimate
                }
              })
              .catch(gasError => {
                console.debug('Gas estimate failed, trying eth_call to extract error', transaction)

                return library
                  .call(estimableTransaction)
                  .then(result => {
                    console.debug('Unexpected successful call after failed estimate gas', transaction, gasError, result)
                    return {
                      transaction,
                      error: new Error('Unexpected issue with estimating the gas. Please try again.')
                    }
                  })
                  .catch(callError => {
                    console.debug('Call threw error', transaction, callError)
                    let errorMessage: string
                    switch (callError.reason) {
                      case 'DXswapRouter: INSUFFICIENT_OUTPUT_AMOUNT':
                      case 'DXswapRouter: EXCESSIVE_INPUT_AMOUNT':
                        errorMessage =
                          'This transaction will not succeed either due to price movement or fee on transfer. Try increasing your slippage tolerance.'
                        break
                      default:
                        errorMessage = `The transaction cannot succeed due to error: ${callError.reason}. This is probably an issue with one of the tokens you are swapping.`
                    }
                    return { transaction, error: new Error(errorMessage) }
                  })
              })
          })
        )

        // a successful estimation is a bignumber gas estimate and the next call is also a bignumber gas estimate
        const successfulEstimation = estimatedCalls.find(
          (el, ix, list): el is SuccessfulCall =>
            'gasEstimate' in el && (ix === list.length - 1 || 'gasEstimate' in list[ix + 1])
        )

        if (!successfulEstimation) {
          const errorCalls = estimatedCalls.filter((call): call is FailedCall => 'error' in call)
          if (errorCalls.length > 0) throw errorCalls[errorCalls.length - 1].error
          throw new Error('Unexpected error. Please contact support: none of the calls threw an error')
        }

        let normalizedGasPrice = undefined
        if (preferredGasPrice && chainId === ChainId.MAINNET) {
          if (!(preferredGasPrice in MainnetGasPrice)) {
            normalizedGasPrice = preferredGasPrice
          } else if (mainnetGasPrices) {
            normalizedGasPrice = mainnetGasPrices[preferredGasPrice as MainnetGasPrice]
          }
        }

        const { transaction, gasEstimate } = successfulEstimation
        const transactionRequest: TransactionRequest = {
          ...transaction,
          from: account,
          gasLimit: calculateGasMargin(gasEstimate),
          gasPrice: normalizedGasPrice ? BigNumber.from(normalizedGasPrice) : undefined,
          type: undefined,
          value: transaction.value
        }
        console.log(transactionRequest)

        const signer = getSigner(library, account)
        return signer
          .sendTransaction(transactionRequest)
          .then((response: any) => {
            const inputSymbol = trade.inputAmount.currency.symbol
            const outputSymbol = trade.outputAmount.currency.symbol
            const inputAmount = trade.inputAmount.toSignificant(3)
            const outputAmount = trade.outputAmount.toSignificant(3)
            const platformName = trade.platform.name

            const base = `Swap ${inputAmount} ${inputSymbol} for ${outputAmount} ${outputSymbol} ${
              platformName !== UniswapV2RoutablePlatform.SWAPR.name ? `on ${platformName}` : ''
            }`
            const withRecipient =
              recipient === account
                ? base
                : `${base} to ${
                    recipientAddressOrName && isAddress(recipientAddressOrName)
                      ? shortenAddress(recipientAddressOrName)
                      : recipientAddressOrName
                  }`

            addTransaction(response, {
              summary: withRecipient
            })

            return response.hash
          })
          .catch((error: any) => {
            // if the user rejected the tx, pass this along
            if (error?.code === 4001) {
              throw new Error('Transaction rejected.')
            } else {
              // otherwise, the error was unexpected and we need to convey that
              console.error(`Swap failed`, error, transaction)
              throw new Error(`Swap failed: ${error.message}`)
            }
          })
      },
      error: null
    }
  }, [
    account,
    addTransaction,
    chainId,
    library,
    mainnetGasPrices,
    preferredGasPrice,
    recipient,
    recipientAddressOrName,
    swapTransactions,
    trade
  ])
}
