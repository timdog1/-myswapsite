// Externals
import { BigNumber, BigNumberish } from '@ethersproject/bignumber'
import { Provider } from '@ethersproject/abstract-provider'
import { Contract } from '@ethersproject/contracts'
import { utils } from 'ethers'
// Contracts
import { getContracts } from './contracts'
// Constants
import { ChainId, COINS_MAINNET, MainnetCoinList } from './constants'
// Curve Router ABI
import REGISTRY_EXCHANGE_ABI from './abi/registry_exchange.json'
import { toBN, getSmallAmountForCoin } from './utils'

/**
 * A CurveFi currency
 */
export type CurveCurrency = keyof typeof COINS_MAINNET | string

export interface GetBestPoolAndOutputParams {
  currencyIn: CurveCurrency
  currencyOut: CurveCurrency
  amountIn: BigNumberish
  provider: Provider
}

/**
 * Returns list of coins avaialble for on Curve for a given chainId
 * @param chainId the target chain ID
 */
export function getCoinList(chainId?: ChainId) {
  const coinList = COINS_MAINNET
  return coinList
}

/**
 * Maps a coin symbol to its contract address for a given chain
 * @param currency
 */
export function mapCurrencyToAddress(currency: CurveCurrency, chainId: ChainId = ChainId.MAINNET): string {
  // Default to mainnet
  const coinList = getCoinList(chainId)
  return coinList[currency.toLowerCase() as keyof MainnetCoinList]
}

export interface GetBestPoolAndOutputResult {
  output: BigNumber
  poolAddress: string
}
// Alias
export type ExchangeExpectedParams = GetBestPoolAndOutputParams

/**
 * Returns the best pool to route a trade through
 * @param param
 * @returns
 */
export async function getBestPoolAndOutput({
  amountIn,
  currencyIn,
  currencyOut,
  provider
}: GetBestPoolAndOutputParams): Promise<GetBestPoolAndOutputResult> {
  // Fetch networId and router address and connect to the contract
  const chainId = (await provider.getNetwork()).chainId as ChainId
  const { addressProvider: addressProviderContract } = await getContracts(provider)
  // Map symbols to address
  const currencyInAddress = mapCurrencyToAddress(currencyIn)
  const currencyOutAddress = mapCurrencyToAddress(currencyOut)
  const coinList = getCoinList(chainId)

  // Curve V2 pools
  const tricryptoCoins = [coinList.usdt.toLowerCase(), coinList.wbtc.toLowerCase(), coinList.weth.toLowerCase()]
  if (
    tricryptoCoins.includes(currencyInAddress.toLowerCase()) &&
    tricryptoCoins.includes(currencyOutAddress.toLowerCase())
  ) {
    throw new Error("This pair can't be exchanged")
  }

  const registryExchangeAddress = await addressProviderContract.get_address(2, {
    gasLimit: 100000 // due to Berlin upgrade. See https://github.com/ethers-io/ethers.js/issues/1474
  })
  const registryExchangeContract = new Contract(registryExchangeAddress, REGISTRY_EXCHANGE_ABI, provider)
  const [poolAddress, output] = await registryExchangeContract.get_best_rate(
    currencyInAddress,
    currencyOutAddress,
    /**
     * @todo determine the token decimals from the contract
     */
    utils.parseUnits(amountIn.toString(), 18)
  )

  return {
    poolAddress,
    output
  }
}

export interface GetCrossAssetExchangeInfoParams {
  currencyIn: CurveCurrency
  currencyOut: CurveCurrency
  amountIn: BigNumberish
  provider: Provider
}

export interface GetCrossAssetExchangeInfoResult {
  route: string[]
  indices: BigNumber[]
  expected: BigNumber
  slippage: number
}

/**
 * IMPORTANT
 * @returns
 */
export async function getCrossAssetExchangeInfo({
  currencyIn,
  currencyOut,
  amountIn,
  provider
}: GetCrossAssetExchangeInfoParams): Promise<GetCrossAssetExchangeInfoResult> {
  // Get router
  const { router: routerContract } = await getContracts(provider)
  // Map symbols to address
  const currencyInAddress = mapCurrencyToAddress(currencyIn)
  const currencyOutAddress = mapCurrencyToAddress(currencyOut)

  const inputCoinDecimals = 18
  const outputCoinDecimals = 18

  // Calculate the amount
  const _amount = utils.parseUnits(amountIn.toString(), inputCoinDecimals)

  const amountBN = toBN(_amount, inputCoinDecimals)

  const [route, indices, expected] = await routerContract.get_exchange_routing(
    currencyInAddress,
    currencyOutAddress,
    _amount,
    {
      getLimit: 10000
    }
  )
  const expectedBN = toBN(expected, outputCoinDecimals)
  const exchangeRateBN = expectedBN.div(amountBN)

  const _smallAmount = utils.parseUnits(getSmallAmountForCoin(currencyInAddress), inputCoinDecimals)
  const smallAmountBN = toBN(_smallAmount, inputCoinDecimals)
  const [, , _expectedSmall] = await routerContract.get_exchange_routing(
    currencyInAddress,
    currencyOutAddress,
    _smallAmount,
    {
      getLimit: 10000
    }
  )
  const expectedSmallBN = toBN(_expectedSmall, outputCoinDecimals)
  const exchangeSmallRateBN = expectedSmallBN.div(smallAmountBN)

  const slippage = 1 - exchangeRateBN.div(exchangeSmallRateBN).toNumber()

  return {
    route,
    indices,
    expected,
    slippage
  }
}

/**
 *
 */
export async function exchangeExpected(params: ExchangeExpectedParams) {
  return (await getBestPoolAndOutput(params)).output
}

/**
 *
 */
export function supportsChain(chinId: number): boolean {
  return chinId === ChainId.MAINNET
}
