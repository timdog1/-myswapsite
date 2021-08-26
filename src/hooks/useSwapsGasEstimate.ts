import { Token, Trade, Currency } from '@swapr/sdk'
import { BigNumber } from 'ethers'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useActiveWeb3React } from '.'
import { INITIAL_ALLOWED_SLIPPAGE } from '../constants'
import { useTokenAllowancesForMultipleSpenders } from '../data/Allowances'
import { MainnetGasPrice } from '../state/application/actions'
import { useMainnetGasPrices } from '../state/application/hooks'
import { Field } from '../state/swap/actions'
import { tryParseAmount, useSwapState } from '../state/swap/hooks'
import { useUserPreferredGasPrice } from '../state/user/hooks'
import { useCurrencyBalance } from '../state/wallet/hooks'
import { calculateGasMargin } from '../utils'
import { useCurrency } from './Tokens'
import useENS from './useENS'
import { useSwapsTransactions } from './useSwapCallback'

export function useSwapsGasEstimations(
  allowedSlippage: number = INITIAL_ALLOWED_SLIPPAGE,
  recipientAddressOrName: string | null,
  trades?: Trade[]
): { loading: boolean; estimations: (BigNumber | null)[] } {
  const { account, library, chainId } = useActiveWeb3React()
  const platformTransactions = useSwapsTransactions(trades, allowedSlippage, recipientAddressOrName)
  const mainnetGasPrices = useMainnetGasPrices()
  const [preferredGasPrice] = useUserPreferredGasPrice()

  const {
    independentField,
    typedValue,
    INPUT: { currencyId: inputCurrencyId },
    OUTPUT: { currencyId: outputCurrencyId }
  } = useSwapState()
  const isExactIn = independentField === Field.INPUT
  const independentCurrencyId = isExactIn ? inputCurrencyId : outputCurrencyId
  const independentCurrency = useCurrency(independentCurrencyId)
  const independentCurrencyBalance = useCurrencyBalance(account || undefined, independentCurrency || undefined)
  const typedIndependentCurrencyAmount = useMemo(
    () => tryParseAmount(typedValue, independentCurrency || undefined, chainId),
    [chainId, independentCurrency, typedValue]
  )

  const targetedAddresses = useMemo(() => platformTransactions.map(transaction => transaction.to as string), [
    platformTransactions
  ])
  const targetAddressesAllowances = useTokenAllowancesForMultipleSpenders(
    independentCurrency as Token,
    account || undefined,
    targetedAddresses
  )

  // this boolean represents whether the user has approved the traded token and whether they
  // have enough balance for the trade to go through or not. If any of the preconditions are
  // not satisfied, the trade won't go through, so no gas estimations are performed
  const calculateGasFees = useMemo(() => {
    return (
      !!account &&
      !!trades &&
      trades.length > 0 &&
      !!preferredGasPrice &&
      (preferredGasPrice in MainnetGasPrice ? !!mainnetGasPrices : true) &&
      targetAddressesAllowances &&
      targetAddressesAllowances.length === trades.length &&
      typedIndependentCurrencyAmount &&
      independentCurrencyBalance &&
      (independentCurrencyBalance.greaterThan(typedIndependentCurrencyAmount) ||
        independentCurrencyBalance.equalTo(typedIndependentCurrencyAmount))
    )
  }, [
    account,
    independentCurrencyBalance,
    mainnetGasPrices,
    preferredGasPrice,
    targetAddressesAllowances,
    trades,
    typedIndependentCurrencyAmount
  ])

  const [loading, setLoading] = useState(false)
  const [estimations, setEstimations] = useState<(BigNumber | null)[]>([])

  const { address: recipientAddress } = useENS(recipientAddressOrName)
  const recipient = recipientAddress || account

  const updateEstimations = useCallback(async () => {
    if (
      !account ||
      !independentCurrency ||
      !targetAddressesAllowances ||
      !trades ||
      !typedIndependentCurrencyAmount ||
      targetAddressesAllowances.length !== trades.length ||
      !library
    )
      return
    setLoading(true)
    const estimatedCalls = []
    for (let i = 0; i < platformTransactions.length; i++) {
      const transaction = platformTransactions[i]
      let estimation = null
      // if the allowance to the router for the traded token is less than the
      // types amount, avoid estimating gas since the tx would fail, printing
      // an horrible error log in the console, continuously
      if (
        Currency.isNative(independentCurrency) ||
        targetAddressesAllowances[i].equalTo(typedIndependentCurrencyAmount) ||
        targetAddressesAllowances[i].greaterThan(typedIndependentCurrencyAmount)
      ) {
        const transactionRequest = { ...transaction, type: undefined, from: account }
        try {
          estimation = calculateGasMargin(await library.estimateGas(transactionRequest))
        } catch (error) {
          console.error(error)
          // silent fail
        }
      }
      estimatedCalls.push(estimation)
    }
    setEstimations(estimatedCalls)
    setLoading(false)
  }, [
    account,
    independentCurrency,
    library,
    platformTransactions,
    targetAddressesAllowances,
    trades,
    typedIndependentCurrencyAmount
  ])

  useEffect(() => {
    if (!trades || trades.length === 0 || !library || !chainId || !recipient || !account || !calculateGasFees) {
      setEstimations([])
      return
    }
    updateEstimations()
  }, [chainId, library, recipient, trades, updateEstimations, account, calculateGasFees])

  return { loading: loading, estimations }
}
