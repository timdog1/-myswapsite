import React, { useCallback, useRef } from 'react'
import styled from 'styled-components'
import { AdvancedDetailsFooter } from '../../components/AdvancedDetailsFooter'
import { ButtonPrimary, ShowMoreButton } from '../../components/Button'
import { HideableAutoColumn } from '../../components/Column'
import { Table, Th } from '../../components/Table'
import { BridgeTransactionSummary } from '../../state/bridgeTransactions/types'
import { TYPE } from '../../theme'
import { BridgeStatusTag } from './BridgeStatusTag'
import { NETWORK_DETAIL } from '../../constants'
import { useBridgeTxsFilter } from '../../state/bridge/hooks'
import { BridgeTxsFilter } from '../../state/bridge/reducer'
import { getExplorerLink } from '../../utils'

interface BridgeTransactionsSummaryProps {
  transactions: BridgeTransactionSummary[]
  collectableTx: BridgeTransactionSummary
  onCollect: (tx: BridgeTransactionSummary) => void
}

export const BridgeTransactionsSummary = ({
  transactions,
  collectableTx,
  onCollect
}: BridgeTransactionsSummaryProps) => {
  const [txsFilter, setTxsFilter] = useBridgeTxsFilter()

  const toggleFilter = useCallback(() => {
    if (txsFilter !== BridgeTxsFilter.RECENT) setTxsFilter(BridgeTxsFilter.RECENT)
    else setTxsFilter(BridgeTxsFilter.NONE)
  }, [setTxsFilter, txsFilter])

  return (
    <>
      <TableContainer>
        <Header>
          <SingleColumnHeader>Bridging</SingleColumnHeader>
          <SingleColumnHeader>From</SingleColumnHeader>
          <SingleColumnHeader>To</SingleColumnHeader>
          <SingleColumnHeader>Status</SingleColumnHeader>
        </Header>
        <Body>
          {Object.values(transactions).map((tx, index) => (
            <BridgeTransactionsSummaryRow key={index} tx={tx} onCollect={onCollect} />
          ))}
        </Body>
      </TableContainer>
      <HideableAutoColumn show>
        <AdvancedDetailsFooter fullWidth padding="16px">
          <Table>
            <thead>
              <tr>
                <Th align="center">Bridging</Th>
                <Th align="center">From</Th>
                <Th align="center">To</Th>
                <Th align="center">Status</Th>
              </tr>
            </thead>
            <tbody>
              {Object.values(transactions).map((tx, index) => (
                <BridgeTransactionsSummaryRow key={index} tx={tx} onCollect={onCollect} />
              ))}
            </tbody>
          </Table>
          {collectableTx && (
            <ButtonPrimary onClick={() => onCollect(collectableTx)} mt="12px">
              Collect
            </ButtonPrimary>
          )}
        </AdvancedDetailsFooter>
      </HideableAutoColumn>

      <ShowMoreButton isOpen={txsFilter === BridgeTxsFilter.NONE} onClick={toggleFilter}>
        Past transactions
      </ShowMoreButton>
    </>
  )
}

const TableContainer = styled.div`
  display: flex;
  flex-flow: column;
  padding: 0;
  margin: 0;
  list-style-none;
`
const Header = styled.div`
  display: flex;
  flex-flow: row;
  justify-content: space-around;
  align-items: center;
  color: #f54242;
  font-size: 1rem;
`
const Body = styled.div`
  display: flex;
  flex-flow: column;
  justify-content: space-between;
`

const SingleRow = styled.div`
  display: flex;
  flex-flow: row;
  justify-content: space-around;

  border-radius: 0.5rem;
  padding: 0.25rem 0rem;
  font-weight: 500;
  font-size: 0.825rem;
  color: ${({ theme }) => theme.text5};
`

const SingleColumn = styled.div`
display: flex
  flex-flow: row;
  justify-content: center;
  align-items: center;
`
const SingleColumnHeader = styled(Header)``

const SingleDotColumn = styled(SingleColumn)<{ success: boolean }>`
  color: ${({ success }) => (success ? '#0e9f6e' : '#8780bf')};
  flex-flow: row;
`
const SingleColumnLeft = styled(SingleColumn)`
  justify-content: flex-start;
`

const TextBridging = styled.div`
color=#ffffff;
   fontSize="14px"; 
   lineHeight="14px"; 
   fontWeight="600"
`

// const Td = styled.td`
//   padding: 0 8px;

//   &:not(:first-child) {
//     text-align: right;
//   }
// `

const Link = styled.a`
  cursor: initial;
  color: #0e9f6e;

  &[href] {
    cursor: pointer;
  }

  &[href]:hover {
    text-decoration: underline;
  }
`

const TextFrom = styled.div`
  position: relative;
`

// const Progress = styled.span<{ dashedLineWidth: number; success: boolean }>`
//   position: absolute;
//   right: -3px;
//   top: 50%;
//   transform: translate(100%, -50%);
//   width: ${({ dashedLineWidth }) => dashedLineWidth - 2 + 'px'};
//   height: 2px;
//   background-color: #8780bf;
//   -webkit-mask-image: repeating-linear-gradient(90deg, transparent, transparent 2px, black 2px, black 4px);
//   mask-image: repeating-linear-gradient(90deg, transparent, transparent 2px, black 2px, black 4px);

//   &:before {
//     content: '';
//     position: absolute;
//     top: 0;
//     left: 0;
//     width: ${({ success }) => (success ? '100%' : '50%')};
//     height: 100%;
//     background-color: #0e9f6e;
//   }
// `

const TextTo = styled(Link)<{ success: boolean }>`
  color: ${({ success }) => (success ? '#0e9f6e' : '#8780bf')};
`

interface BridgeTransactionsSummaryRow {
  tx: BridgeTransactionSummary
  onCollect: BridgeTransactionsSummaryProps['onCollect']
}

const BridgeTransactionsSummaryRow = ({ tx, onCollect }: BridgeTransactionsSummaryRow) => {
  const { assetName, fromChainId, status, toChainId, value, pendingReason, log } = tx

  const refFrom = useRef<HTMLDivElement>(null)
  const refTo = useRef<HTMLAnchorElement>(null)

  const success = status === 'confirmed' || status === 'claimed'

  return (
    <SingleRow>
      <SingleColumnLeft>
        <TextBridging>
          {value} {assetName}
        </TextBridging>
      </SingleColumnLeft>
      <SingleColumn>
        <TYPE.main color="text4" fontSize="10px" lineHeight="12px" display="inline">
          <TextFrom ref={refFrom}>
            <Link
              href={getExplorerLink(log[0].chainId, log[0].txHash, 'transaction')}
              rel="noopener noreferrer"
              target="_blank"
            >
              {NETWORK_DETAIL[fromChainId].chainName}
            </Link>
          </TextFrom>
        </TYPE.main>
      </SingleColumn>
      <SingleColumn>
        <SingleDotColumn success={true}>${status}</SingleDotColumn>
        <SingleDotColumn success={success}>,,,</SingleDotColumn>
      </SingleColumn>
      <SingleColumn>
        <TYPE.main color="text4" fontSize="10px" lineHeight="12px" display="inline">
          <TextTo
            success={success}
            ref={refTo}
            href={log[1] && getExplorerLink(log[1].chainId, log[1].txHash, 'transaction')}
            rel="noopener noreferrer"
            target="_blank"
          >
            {NETWORK_DETAIL[toChainId].chainName}
          </TextTo>
        </TYPE.main>
      </SingleColumn>
      <td align="right">
        <BridgeStatusTag status={status} pendingReason={pendingReason} onCollect={() => onCollect(tx)} />
      </td>
    </SingleRow>
  )
}
