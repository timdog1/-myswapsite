import React from 'react'
import styled from 'styled-components'
import { Redirect, RouteComponentProps } from 'react-router-dom'
import { SwapPoolTabs } from '../../../components/NavigationTabs'
import { PageWrapper } from '../styleds'

import { TYPE } from '../../../theme'
import { Box, Flex } from 'rebass'
import { RowBetween } from '../../../components/Row'
import { AutoColumn } from '../../../components/Column'

import { useToken } from '../../../hooks/Tokens'
import { UndecoratedLink } from '../../../components/UndercoratedLink'
import DoubleCurrencyLogo from '../../../components/DoubleLogo'
import { PairState, usePair } from '../../../data/Reserves'
import LiquidityMiningCampaignView from '../../../components/Pool/LiquidityMiningCampaignView'
import { useLiquidityMiningCampaign } from '../../../hooks/useLiquidityMiningCampaign'
import Skeleton from 'react-loading-skeleton'

const TitleRow = styled(RowBetween)`
  ${({ theme }) => theme.mediaWidth.upToSmall`
    flex-wrap: wrap;
    gap: 12px;
    width: 100%;
    flex-direction: column-reverse;
  `};
`

export default function LiquidityMiningCampaign({
  match: {
    params: { currencyIdA, currencyIdB, liquidityMiningCampaignId }
  }
}: RouteComponentProps<{ currencyIdA: string; currencyIdB: string; liquidityMiningCampaignId: string }>) {
  const token0 = useToken(currencyIdA)
  const token1 = useToken(currencyIdB)
  const wrappedPair = usePair(token0 || undefined, token1 || undefined)
  const { campaign } = useLiquidityMiningCampaign(wrappedPair[1] || undefined, liquidityMiningCampaignId)

  if (token0 && token1 && (wrappedPair[0] === PairState.NOT_EXISTS || wrappedPair[0] === PairState.INVALID))
    return <Redirect to="/pools" />
  return (
    <PageWrapper>
      <SwapPoolTabs active={'pool'} />
      <AutoColumn gap="lg" justify="center">
        <AutoColumn gap="lg" style={{ width: '100%' }}>
          <TitleRow style={{ marginTop: '1rem' }} padding={'0'}>
            <Flex alignItems="center">
              <Box mr="8px">
                <UndecoratedLink to="/pools">
                  <TYPE.mediumHeader fontWeight="400" fontSize="26px" lineHeight="32px" color="text4">
                    Pairs
                  </TYPE.mediumHeader>
                </UndecoratedLink>
              </Box>
              <Box mr="8px">
                <TYPE.mediumHeader fontWeight="400" fontSize="26px" lineHeight="32px" color="text4">
                  /
                </TYPE.mediumHeader>
              </Box>
              <Box mr="4px">
                <DoubleCurrencyLogo
                  loading={!token0 || !token1}
                  currency0={token0 || undefined}
                  currency1={token1 || undefined}
                  size={20}
                />
              </Box>
              <Box>
                <TYPE.small color="text4" fontWeight="600" fontSize="16px" lineHeight="20px">
                  {!token0 || !token1 ? <Skeleton width="60px" /> : `${token0.symbol}/${token1.symbol}`}
                </TYPE.small>
              </Box>
            </Flex>
          </TitleRow>
          <LiquidityMiningCampaignView campaign={campaign} />
        </AutoColumn>
      </AutoColumn>
    </PageWrapper>
  )
}
