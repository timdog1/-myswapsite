import { Currency, CurrencyAmount, Pair, RoutablePlatform, Token, Trade, UniswapV2Trade, TradeType } from '@swapr/sdk'
import flatMap from 'lodash.flatmap'
import { useEffect, useMemo, useState } from 'react'

import { BASES_TO_CHECK_TRADES_AGAINST } from '../constants'
import { PairState, usePairs } from '../data/Reserves'
import { useIsMultihop } from '../state/user/hooks'
import { sortTradesByExecutionPrice } from '../utils/prices'
import { wrappedCurrency } from '../utils/wrappedCurrency'

import { useActiveWeb3React } from './index'

function useAllCommonPairs(
  currencyA?: Currency,
  currencyB?: Currency,
  platform: RoutablePlatform = RoutablePlatform.SWAPR
): Pair[] {
  const { chainId } = useActiveWeb3React()

  const bases: Token[] = useMemo(() => (chainId ? BASES_TO_CHECK_TRADES_AGAINST[chainId] : []), [chainId])

  const [tokenA, tokenB] = chainId
    ? [wrappedCurrency(currencyA, chainId), wrappedCurrency(currencyB, chainId)]
    : [undefined, undefined]

  const basePairs: [Token, Token][] = useMemo(
    () =>
      flatMap(bases, (base): [Token, Token][] => bases.map(otherBase => [base, otherBase])).filter(
        ([t0, t1]) => t0.address !== t1.address
      ),
    [bases]
  )

  const allPairCombinations: [Token, Token][] = useMemo(
    () =>
      tokenA && tokenB
        ? [
            // the direct pair
            [tokenA, tokenB],
            // token A against all bases
            ...bases.map((base): [Token, Token] => [tokenA, base]),
            // token B against all bases
            ...bases.map((base): [Token, Token] => [tokenB, base]),
            // each base against all bases
            ...basePairs
          ]
            .filter((tokens): tokens is [Token, Token] => Boolean(tokens[0] && tokens[1]))
            .filter(([t0, t1]) => t0.address !== t1.address)
        : [],
    [tokenA, tokenB, bases, basePairs]
  )

  const allPairs = usePairs(allPairCombinations, platform)

  // only pass along valid pairs, non-duplicated pairs
  return useMemo(
    () =>
      Object.values(
        allPairs
          // filter out invalid pairs
          .filter((result): result is [PairState.EXISTS, Pair] => Boolean(result[0] === PairState.EXISTS && result[1]))
          // filter out duplicated pairs
          .reduce<{ [pairAddress: string]: Pair }>((memo, [, curr]) => {
            memo[curr.liquidityToken.address] = memo[curr.liquidityToken.address] ?? curr
            return memo
          }, {})
      ),
    [allPairs]
  )
}

/**
 * Returns the best trade for the exact amount of tokens in to the given token out
 */
export function useBestTradeExactInUniswapV2Platform(
  currencyAmountIn?: CurrencyAmount,
  currencyOut?: Currency,
  platform: RoutablePlatform = RoutablePlatform.SWAPR
): Trade | undefined {
  const { chainId } = useActiveWeb3React()
  const allowedPairs = useAllCommonPairs(currencyAmountIn?.currency, currencyOut, platform)
  const multihop = useIsMultihop()
  const [bestTrade, setBestTrade] = useState<Trade | undefined>()

  useEffect(() => {
    const fetchBestTrade = async () => {
      if (currencyAmountIn && currencyOut && allowedPairs.length > 0 && chainId && platform.supportsChain(chainId)) {
        setBestTrade(
          (
            await UniswapV2Trade.bestTradeExactIn(allowedPairs, currencyAmountIn, currencyOut, {
              maxHops: multihop ? 3 : 1,
              maxNumResults: 1
            })
          )[0]
        )
      }
    }
    fetchBestTrade()
  }, [currencyAmountIn, currencyOut, allowedPairs, chainId, platform, multihop])

  return bestTrade
}

/**
 * Returns the best trade for the token in to the exact amount of token out
 */
export function useBestTradeExactOutUniswapV2Platform(
  currencyIn?: Currency,
  currencyAmountOut?: CurrencyAmount,
  platform: RoutablePlatform = RoutablePlatform.SWAPR
): Trade | undefined {
  const { chainId } = useActiveWeb3React()
  const allowedPairs = useAllCommonPairs(currencyIn, currencyAmountOut?.currency, platform)
  const multihop = useIsMultihop()
  const [bestTrade, setBestTrade] = useState<Trade | undefined>()

  useEffect(() => {
    const fetchBestTrade = async () => {
      if (currencyIn && currencyAmountOut && allowedPairs.length > 0 && chainId && platform.supportsChain(chainId)) {
        setBestTrade(
          (
            await UniswapV2Trade.bestTradeExactOut(allowedPairs, currencyIn, currencyAmountOut, {
              maxHops: multihop ? 3 : 1,
              maxNumResults: 1
            })
          )[0]
        )
      }
    }
    fetchBestTrade()
  }, [currencyIn, currencyAmountOut, allowedPairs, chainId, platform, multihop])

  return bestTrade
}

/**
 * Returns the best trade for the exact amount of tokens in to the given token out
 * for each supported platform. Order is by lowest price ascending.
 */
export function useTradeExactInAllPlatforms(
  currencyAmountIn?: CurrencyAmount,
  currencyOut?: Currency
): (Trade | undefined)[] {
  const bestSwaprTrade = useBestTradeExactInUniswapV2Platform(currencyAmountIn, currencyOut, RoutablePlatform.SWAPR)
  const bestUniswapTrade = useBestTradeExactInUniswapV2Platform(currencyAmountIn, currencyOut, RoutablePlatform.UNISWAP)
  const bestSushiswapTrade = useBestTradeExactInUniswapV2Platform(
    currencyAmountIn,
    currencyOut,
    RoutablePlatform.SUSHISWAP
  )
  const bestHoneyswapTrade = useBestTradeExactInUniswapV2Platform(
    currencyAmountIn,
    currencyOut,
    RoutablePlatform.HONEYSWAP
  )
  const bestBaoswapTrade = useBestTradeExactInUniswapV2Platform(currencyAmountIn, currencyOut, RoutablePlatform.BAOSWAP)
  const bestLevinswapTrade = useBestTradeExactInUniswapV2Platform(
    currencyAmountIn,
    currencyOut,
    RoutablePlatform.LEVINSWAP
  )

  return useMemo(() => {
    return sortTradesByExecutionPrice(
      [bestSwaprTrade, bestUniswapTrade, bestSushiswapTrade, bestHoneyswapTrade, bestBaoswapTrade, bestLevinswapTrade],
      TradeType.EXACT_INPUT
    ).filter(trade => !!trade)
  }, [bestBaoswapTrade, bestHoneyswapTrade, bestLevinswapTrade, bestSushiswapTrade, bestSwaprTrade, bestUniswapTrade])
}

/**
 * Returns the best trade for the token in to the exact amount of token out
 * for each supported platform. Order is by lowest price ascending.
 */
export function useTradeExactOutAllPlatforms(
  currencyIn?: Currency,
  currencyAmountOut?: CurrencyAmount
): (Trade | undefined)[] {
  const bestSwaprTrade = useBestTradeExactOutUniswapV2Platform(currencyIn, currencyAmountOut, RoutablePlatform.SWAPR)
  const bestUniswapTrade = useBestTradeExactOutUniswapV2Platform(
    currencyIn,
    currencyAmountOut,
    RoutablePlatform.UNISWAP
  )
  const bestSushiswapTrade = useBestTradeExactOutUniswapV2Platform(
    currencyIn,
    currencyAmountOut,
    RoutablePlatform.SUSHISWAP
  )
  const bestHoneyswapTrade = useBestTradeExactOutUniswapV2Platform(
    currencyIn,
    currencyAmountOut,
    RoutablePlatform.HONEYSWAP
  )
  const bestBaoswapTrade = useBestTradeExactOutUniswapV2Platform(
    currencyIn,
    currencyAmountOut,
    RoutablePlatform.BAOSWAP
  )
  const bestLevinswapTrade = useBestTradeExactOutUniswapV2Platform(
    currencyIn,
    currencyAmountOut,
    RoutablePlatform.LEVINSWAP
  )

  return useMemo(() => {
    return sortTradesByExecutionPrice(
      [bestSwaprTrade, bestUniswapTrade, bestSushiswapTrade, bestHoneyswapTrade, bestBaoswapTrade, bestLevinswapTrade],
      TradeType.EXACT_OUTPUT
    ).filter(trade => !!trade)
  }, [bestBaoswapTrade, bestHoneyswapTrade, bestLevinswapTrade, bestSushiswapTrade, bestSwaprTrade, bestUniswapTrade])
}
