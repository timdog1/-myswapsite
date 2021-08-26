import { Trade, Route, Breakdown } from '@swapr/sdk'
import React, { Fragment, memo, useContext } from 'react'
import { ChevronRight, Plus } from 'react-feather'
import { Box, Flex } from 'rebass'
import styled, { ThemeContext } from 'styled-components'
import { TYPE } from '../../theme'
import CurrencyLogo from '../CurrencyLogo'

const StyledChevronRight = styled(ChevronRight)`
  height: 17px;
  color: ${props => props.theme.purple3};
`

const StyledPlus = styled(Plus)`
  height: 17px;
  margin: 0 4px;
  color: ${props => props.theme.purple3};
`

export default memo(function SwapDetails({ trade }: { trade: Trade }) {
  const theme = useContext(ThemeContext)

  let detailsComponent = null
  let titleText = ''
  if (trade.details instanceof Route) {
    if (trade.details.path.length === 0) return null
    titleText = 'Route'
    detailsComponent = (
      <Flex width="100%" justifyContent="flex-end" alignItems="center">
        {trade.details.path.map((token, i, path) => {
          const isLastItem: boolean = i === path.length - 1
          return (
            <Fragment key={i}>
              <Flex alignItems="center">
                <CurrencyLogo currency={token} size="14px" />
                <TYPE.black fontSize="13px" lineHeight="17px" fontWeight="600" color={theme.text1} ml="4px">
                  {token.symbol}
                </TYPE.black>
              </Flex>
              {!isLastItem && <StyledChevronRight />}
            </Fragment>
          )
        })}
      </Flex>
    )
  } else if (trade.details instanceof Breakdown) {
    if (trade.details.platforms.length === 0) return null
    titleText = 'Breakdown'
    const displayablePlatforms = trade.details.platforms.slice(0, 3)
    const displayTooltip = displayablePlatforms.length < trade.details.platforms.length
    detailsComponent = (
      <Flex width="100%" justifyContent="flex-end" alignItems="center">
        {displayablePlatforms.map((platform, i, path) => {
          const isLastItem: boolean = i === path.length - 1
          return (
            <Fragment key={i}>
              <Flex flexDirection="column">
                <Box mb="2px">
                  <TYPE.black fontSize="13px" lineHeight="17px" fontWeight="600" color={theme.text1} ml="4px">
                    {platform.name}
                  </TYPE.black>
                </Box>
                <Box>
                  <TYPE.black fontSize="13px" lineHeight="17px" fontWeight="600" color={theme.text4} ml="4px">
                    {platform.percentage.toFixed(2)}%
                  </TYPE.black>
                </Box>
              </Flex>
              {!isLastItem && <StyledPlus />}
            </Fragment>
          )
        })}
        {displayTooltip && 'Wat'}
      </Flex>
    )
  }
  return (
    <Flex px="2px" pr="4px" width="100%" justifyContent="space-between">
      <Box mr="12px">
        <TYPE.body fontSize="12px" lineHeight="15px" fontWeight="500" minWidth="auto">
          {titleText}:
        </TYPE.body>
      </Box>
      <Box>{detailsComponent}</Box>
    </Flex>
  )
})
