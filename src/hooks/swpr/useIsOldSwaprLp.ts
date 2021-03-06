import { gql, useQuery } from '@apollo/client'
import { getAddress } from 'ethers/lib/utils'
import { useMemo } from 'react'
import { useActiveWeb3React } from '../'
import { oldBuildClient } from '../../apollo/client'
import { OLD_SWPR } from '../../constants'

// Only fetches liquidity and liquidity mining positions in which the user
// has a stake (LP token balance or staked amount > 0).
// Will then check the LP token to see if it relates with an old SWPR pair
const QUERY = gql`
  query($account: ID!) {
    liquidityPositions(where: { user: $account, liquidityTokenBalance_gt: 0 }) {
      pair {
        token0 {
          address: id
        }
        token1 {
          address: id
        }
      }
    }
    liquidityMiningPositions(where: { user: $account, stakedAmount_gt: 0 }) {
      pair: targetedPair {
        token0 {
          address: id
        }
        token1 {
          address: id
        }
      }
    }
  }
`

interface SubgraphPair {
  token0: { address: string }
  token1: { address: string }
}

interface QueryResult {
  liquidityPositions: { pair: SubgraphPair }[]
  liquidityMiningPositions: { pair: SubgraphPair }[]
}

export function useIsOldSwaprLp(
  account?: string
): {
  loading: boolean
  isOldSwaprLp: boolean
} {
  const { chainId } = useActiveWeb3React()
  const oldSwprTokenAddress = useMemo(() => {
    if (!chainId) return undefined
    const oldSwpr = OLD_SWPR[chainId]
    return oldSwpr ? getAddress(oldSwpr.address) : undefined
  }, [chainId])
  const { loading: loadingMyPairs, data, error } = useQuery<QueryResult>(QUERY, {
    client: oldBuildClient,
    fetchPolicy: 'network-only',
    pollInterval: 3000,
    variables: {
      account: account?.toLowerCase() || ''
    }
  })

  if (loadingMyPairs) return { loading: true, isOldSwaprLp: false }
  if (
    !data ||
    !data.liquidityPositions ||
    !data.liquidityMiningPositions ||
    (data.liquidityPositions.length === 0 && data.liquidityMiningPositions.length === 0) ||
    error ||
    !chainId ||
    !oldSwprTokenAddress
  )
    return { loading: false, isOldSwaprLp: false }
  return {
    loading: false,
    isOldSwaprLp: data.liquidityMiningPositions.length > 0 || data.liquidityPositions.length > 0
  }
}
