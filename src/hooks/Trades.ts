import {
  Currency,
  CurrencyAmount,
  Pair,
  UniswapV2RoutablePlatform,
  Token,
  Trade,
  UniswapV2Trade,
  ZeroXTrade,
  TradeType,
  Percent,
  JSBI,
  RoutablePlatform
} from '@swapr/sdk'
import flatMap from 'lodash.flatmap'
import { useEffect, useMemo, useState } from 'react'
import { useDebounce } from 'react-use'

import { BASES_TO_CHECK_TRADES_AGAINST, BIPS_BASE } from '../constants'
import { PairState, usePairs } from '../data/Reserves'
import { useIsMultihop, useUserSlippageTolerance } from '../state/user/hooks'
import { sortTradesByExecutionPrice } from '../utils/prices'
import { wrappedCurrency } from '../utils/wrappedCurrency'

import { useActiveWeb3React } from './index'

function useAllCommonPairs(
  currencyA?: Currency,
  currencyB?: Currency,
  platform: UniswapV2RoutablePlatform = UniswapV2RoutablePlatform.SWAPR
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
  platform: UniswapV2RoutablePlatform = UniswapV2RoutablePlatform.SWAPR
): Trade | undefined {
  const { chainId } = useActiveWeb3React()
  const allowedPairs = useAllCommonPairs(currencyAmountIn?.currency, currencyOut, platform)
  const multihop = useIsMultihop()
  const [slippageTolerance] = useUserSlippageTolerance()
  const [bestTrade, setBestTrade] = useState<Trade | undefined>()

  useEffect(() => {
    const fetchBestTrade = async () => {
      if (currencyAmountIn && currencyOut && allowedPairs.length > 0 && chainId && platform.supportsChain(chainId)) {
        setBestTrade(
          await UniswapV2Trade.bestTradeExactIn(
            currencyAmountIn,
            currencyOut,
            new Percent(JSBI.BigInt(slippageTolerance), BIPS_BASE),
            allowedPairs,
            {
              maxHops: multihop ? 3 : 1,
              maxNumResults: 1
            }
          )
        )
      }
    }
    fetchBestTrade()
  }, [currencyAmountIn, currencyOut, allowedPairs, chainId, platform, multihop, slippageTolerance])

  return bestTrade
}

/**
 * Returns the best trade for the token in to the exact amount of token out
 */
export function useBestTradeExactOutUniswapV2Platform(
  currencyIn?: Currency,
  currencyAmountOut?: CurrencyAmount,
  platform: UniswapV2RoutablePlatform = UniswapV2RoutablePlatform.SWAPR
): Trade | undefined {
  const { chainId } = useActiveWeb3React()
  const allowedPairs = useAllCommonPairs(currencyIn, currencyAmountOut?.currency, platform)
  const multihop = useIsMultihop()
  const [slippageTolerance] = useUserSlippageTolerance()
  const [bestTrade, setBestTrade] = useState<Trade | undefined>()

  useEffect(() => {
    const fetchBestTrade = async () => {
      if (currencyIn && currencyAmountOut && allowedPairs.length > 0 && chainId && platform.supportsChain(chainId)) {
        setBestTrade(
          await UniswapV2Trade.bestTradeExactOut(
            currencyIn,
            currencyAmountOut,
            new Percent(JSBI.BigInt(slippageTolerance), BIPS_BASE),
            allowedPairs,
            {
              maxHops: multihop ? 3 : 1,
              maxNumResults: 1
            }
          )
        )
      }
    }
    fetchBestTrade()
  }, [currencyIn, currencyAmountOut, allowedPairs, chainId, platform, multihop, slippageTolerance])

  return bestTrade
}

export function useBestTradeExactIn0x(currencyAmountIn?: CurrencyAmount, currencyOut?: Currency): Trade | undefined {
  const { chainId } = useActiveWeb3React()
  const [slippageTolerance] = useUserSlippageTolerance()
  const [bestTrade, setBestTrade] = useState<Trade | undefined>()

  useDebounce(
    () => {
      const fetchBestTrade = async () => {
        if (currencyAmountIn && currencyOut && chainId && RoutablePlatform.ZEROX.supportsChain(chainId)) {
          setBestTrade(
            await ZeroXTrade.bestTradeExactIn(
              currencyAmountIn,
              currencyOut,
              new Percent(JSBI.BigInt(slippageTolerance), BIPS_BASE)
            )
          )
        }
      }
      fetchBestTrade()
    },
    500,
    [currencyAmountIn, currencyOut, chainId, slippageTolerance]
  )

  return bestTrade
}

export function useBestTradeExactOut0x(currencyIn?: Currency, currencyAmountOut?: CurrencyAmount): Trade | undefined {
  const { chainId } = useActiveWeb3React()
  const [slippageTolerance] = useUserSlippageTolerance()
  const [bestTrade, setBestTrade] = useState<Trade | undefined>()

  useDebounce(
    () => {
      const fetchBestTrade = async () => {
        if (currencyIn && currencyAmountOut && chainId && RoutablePlatform.ZEROX.supportsChain(chainId)) {
          setBestTrade(
            await ZeroXTrade.bestTradeExactOut(
              currencyIn,
              currencyAmountOut,
              new Percent(JSBI.BigInt(slippageTolerance), BIPS_BASE)
            )
          )
        }
      }
      fetchBestTrade()
    },
    500,
    [currencyIn, currencyAmountOut, chainId, slippageTolerance]
  )

  return bestTrade
}

/**
 * Returns the best trade for the exact amount of tokens in to the given token out
 * for each supported platform. Order is by lowest price ascending.
 */
export function useTradeExactInAllPlatforms(currencyAmountIn?: CurrencyAmount, currencyOut?: Currency): Trade[] {
  const bestSwaprTrade = useBestTradeExactInUniswapV2Platform(
    currencyAmountIn,
    currencyOut,
    UniswapV2RoutablePlatform.SWAPR
  )
  const bestUniswapTrade = useBestTradeExactInUniswapV2Platform(
    currencyAmountIn,
    currencyOut,
    UniswapV2RoutablePlatform.UNISWAP
  )
  const bestSushiswapTrade = useBestTradeExactInUniswapV2Platform(
    currencyAmountIn,
    currencyOut,
    UniswapV2RoutablePlatform.SUSHISWAP
  )
  const bestHoneyswapTrade = useBestTradeExactInUniswapV2Platform(
    currencyAmountIn,
    currencyOut,
    UniswapV2RoutablePlatform.HONEYSWAP
  )
  const bestBaoswapTrade = useBestTradeExactInUniswapV2Platform(
    currencyAmountIn,
    currencyOut,
    UniswapV2RoutablePlatform.BAOSWAP
  )
  const bestLevinswapTrade = useBestTradeExactInUniswapV2Platform(
    currencyAmountIn,
    currencyOut,
    UniswapV2RoutablePlatform.LEVINSWAP
  )
  const best0XTrade = useBestTradeExactIn0x(currencyAmountIn, currencyOut)

  return useMemo(() => {
    const bestTradesByPlatform = [
      bestSwaprTrade,
      bestUniswapTrade,
      bestSushiswapTrade,
      bestHoneyswapTrade,
      bestBaoswapTrade,
      bestLevinswapTrade,
      best0XTrade
    ].filter(trade => !!trade) as Trade[]
    return sortTradesByExecutionPrice(bestTradesByPlatform, TradeType.EXACT_INPUT)
  }, [
    bestBaoswapTrade,
    bestHoneyswapTrade,
    bestLevinswapTrade,
    bestSushiswapTrade,
    bestSwaprTrade,
    bestUniswapTrade,
    best0XTrade
  ])
}

/**
 * Returns the best trade for the token in to the exact amount of token out
 * for each supported platform. Order is by lowest price ascending.
 */
export function useTradeExactOutAllPlatforms(currencyIn?: Currency, currencyAmountOut?: CurrencyAmount): Trade[] {
  const bestSwaprTrade = useBestTradeExactOutUniswapV2Platform(
    currencyIn,
    currencyAmountOut,
    UniswapV2RoutablePlatform.SWAPR
  )
  const bestUniswapTrade = useBestTradeExactOutUniswapV2Platform(
    currencyIn,
    currencyAmountOut,
    UniswapV2RoutablePlatform.UNISWAP
  )
  const bestSushiswapTrade = useBestTradeExactOutUniswapV2Platform(
    currencyIn,
    currencyAmountOut,
    UniswapV2RoutablePlatform.SUSHISWAP
  )
  const bestHoneyswapTrade = useBestTradeExactOutUniswapV2Platform(
    currencyIn,
    currencyAmountOut,
    UniswapV2RoutablePlatform.HONEYSWAP
  )
  const bestBaoswapTrade = useBestTradeExactOutUniswapV2Platform(
    currencyIn,
    currencyAmountOut,
    UniswapV2RoutablePlatform.BAOSWAP
  )
  const bestLevinswapTrade = useBestTradeExactOutUniswapV2Platform(
    currencyIn,
    currencyAmountOut,
    UniswapV2RoutablePlatform.LEVINSWAP
  )
  const best0xTrade = useBestTradeExactOut0x(currencyIn, currencyAmountOut)

  return useMemo(() => {
    const bestTradesByPlatform = [
      bestSwaprTrade,
      bestUniswapTrade,
      bestSushiswapTrade,
      bestHoneyswapTrade,
      bestBaoswapTrade,
      bestLevinswapTrade,
      best0xTrade
    ].filter(trade => !!trade) as Trade[]
    return sortTradesByExecutionPrice(bestTradesByPlatform, TradeType.EXACT_OUTPUT)
  }, [
    bestBaoswapTrade,
    bestHoneyswapTrade,
    bestLevinswapTrade,
    bestSushiswapTrade,
    bestSwaprTrade,
    bestUniswapTrade,
    best0xTrade
  ])
}
