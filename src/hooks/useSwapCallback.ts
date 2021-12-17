import { UniswapV2Trade, TradeType, UniswapV2RoutablePlatform } from '@swapr/sdk'
import { TransactionRequest } from '@ethersproject/providers'
import { BigNumber } from '@ethersproject/bignumber'
import { Contract } from '@ethersproject/contracts'
import { UnsignedTransaction } from 'ethers'
import { useMemo } from 'react'
import { INITIAL_ALLOWED_SLIPPAGE } from '../constants'
import { useTransactionAdder } from '../state/transactions/hooks'
import { getRouterContract, isAddress, shortenAddress } from '../utils'
import { useActiveWeb3React } from './index'
import useTransactionDeadline from './useTransactionDeadline'
import useENS from './useENS'

export enum SwapCallbackState {
  INVALID,
  LOADING,
  VALID
}

interface SwapCall {
  contract: Contract
  parameters: Promise<UnsignedTransaction>
}

interface SuccessfulCall {
  call: SwapCall
  gasEstimate: BigNumber
}

interface FailedCall {
  call: SwapCall
  error: Error
}

type EstimatedSwapCall = SuccessfulCall | FailedCall

/**
 * Returns the swap calls that can be used to make the trade
 * @param trade trade to execute
 * @param allowedSlippage user allowed slippage
 * @param recipientAddressOrName
 */
export function useSwapsCallArguments(
  trades: (UniswapV2Trade | undefined)[] | undefined, // trade to execute, required
  allowedSlippage: number = INITIAL_ALLOWED_SLIPPAGE, // in bips
  recipientAddressOrName: string | null // the ENS name or address of the recipient of the trade, or null if swap should be returned to sender
): SwapCall[][] {
  const { account, chainId, library } = useActiveWeb3React()

  const { address: recipientAddress } = useENS(recipientAddressOrName)
  const recipient = recipientAddressOrName === null ? account : recipientAddress
  const deadline = useTransactionDeadline()

  return useMemo(() => {
    if (!trades || trades.length === 0 || !recipient || !library || !account || !chainId || !deadline) return []

    return trades.map(trade => {
      if (!trade) {
        return []
      }
      const contract: Contract | null = getRouterContract(chainId, library, trade.platform, account)
      if (!contract) {
        return []
      }

      const swapMethods = []
      swapMethods.push(
        trade.swapTransaction({
          recipient,
          ttl: deadline.toNumber()
        })
      )

      if (trade.tradeType === TradeType.EXACT_INPUT) {
        // swapMethods.push(
        //   Router.swapCallParameters(trade, {
        //     feeOnTransfer: true,
        //     allowedSlippage: new Percent(JSBI.BigInt(allowedSlippage), BIPS_BASE),
        //     recipient,
        //     ttl: deadline.toNumber()
        //   })
        // )
      }

      return swapMethods.map(parameters => ({ parameters, contract }))
    })
  }, [account, chainId, deadline, library, recipient, trades])
}

// returns a function that will execute a swap, if the parameters are all valid
// and the user has approved the slippage adjusted input amount for the trade
export function useSwapCallback(
  trade: UniswapV2Trade | undefined, // trade to execute, required
  allowedSlippage: number = INITIAL_ALLOWED_SLIPPAGE, // in bips
  recipientAddressOrName: string | null // the ENS name or address of the recipient of the trade, or null if swap should be returned to sender
): { state: SwapCallbackState; callback: null | (() => Promise<string>); error: string | null } {
  const { account, chainId, library } = useActiveWeb3React()
  // const mainnetGasPrices = useMainnetGasPrices()
  // const [preferredGasPrice] = useUserPreferredGasPrice()

  const memoizedTrades = useMemo(() => (trade ? [trade] : undefined), [trade])
  const [swapCalls] = useSwapsCallArguments(memoizedTrades, allowedSlippage, recipientAddressOrName)

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
          swapCalls.map(async call => {
            const { parameters } = call
            // Extract the unsigned transaction request
            const transactionRequest = await parameters

            // Try to estimate gas
            return library
              .estimateGas(transactionRequest as any)
              .then((gasEstimate: BigNumber) => {
                return {
                  call: {
                    ...transactionRequest
                  },
                  gasEstimate
                } as SuccessfulCall
              })
              .catch((gasError: Error) => {
                console.debug('Gas estimate failed', call, gasError)

                return {
                  call,
                  error: new Error(`Gas estimate failed: ${gasError.message}`)
                }

                /**
                 *
                return contract.callStatic[methodName](...args, options)
                  .then(result => {
                    console.debug('Unexpected successful call after failed estimate gas', call, gasError, result)
                    return {
                      call,
                      error: new Error('Unexpected issue with estimating the gas. Please try again.')
                    }
                  })
                  .catch(callError => {
                    console.debug('Call threw error', call, callError)
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
                    return { call, error: new Error(errorMessage) }
                  })
                  */
              })
          })
        )

        return library
          .getSigner()
          .sendTransaction((await estimatedCalls[0].call.parameters) as TransactionRequest)
          .then(response => {
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
              console.error(`Swap failed`, error, estimatedCalls[0].call)
              throw new Error(`Swap failed: ${error.message}`)
            }
          })
      },
      error: null
    }
  }, [trade, library, account, chainId, recipient, recipientAddressOrName, swapCalls, addTransaction])
}
