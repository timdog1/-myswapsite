import React, { useCallback, useRef } from 'react'
import styled from 'styled-components'
import { AdvancedDetailsFooter } from '../../components/AdvancedDetailsFooter'
import { ButtonPrimary, ShowMoreButton } from '../../components/Button'
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
      <AdvancedDetailsFooter fullWidth padding="0px">
        <TableContainer>
          <Header>
            <ColumnBridging>Bridging</ColumnBridging>
            <ColumnFromToHeader>
              <Column>From</Column>
              <Column>To</Column>
            </ColumnFromToHeader>
            <Column>Status</Column>
          </Header>
          <Body>
            {Object.values(transactions).map((tx, index) => (
              <BridgeTransactionsSummaryRow key={index} tx={tx} onCollect={onCollect} />
            ))}
          </Body>
        </TableContainer>

        {collectableTx && (
          <ButtonPrimary onClick={() => onCollect(collectableTx)} mt="12px">
            Collect
          </ButtonPrimary>
        )}
      </AdvancedDetailsFooter>

      <ShowMoreButton isOpen={txsFilter === BridgeTxsFilter.NONE} onClick={toggleFilter}>
        Past transactions
      </ShowMoreButton>
    </>
  )
}

const TableContainer = styled.div`
  display: flex;
  flex-flow: column;
`
const Header = styled.div`
  display: flex;
  justify-content: space-around;
  align-items: center;
  flex-flow: row;
  padding: 10px;
  font-size: 12px;
  font-weight: 600;
  line-height: 12px;
  text-transform: uppercase;
  color: ${props => props.theme.purple3};
`
const Body = styled.div`
  flex-flow: column;
  justify-content: space-between;
`

const Row = styled.div`
  display: flex;
  flex-flow: row;
  justify-content: space-around;
  padding: 0.25rem 0rem;
  font-weight: 500;
  font-size: 0.825rem;
  color: ${({ theme }) => theme.text5};
`

const Column = styled.div`
  display: flex
  flex-flow: row;
  align-items: center;
`

const ColumnBridging = styled(Column)`
  flex-basis: 25%;
`

const ColumnFromTo = styled(Column)`
  justify-content: center;
`

const ColumnFromToHeader = styled(Column)`
  flex-basis: 30%;
  justify-content: space-between;
`

const Dots = ({ success }: { success: boolean }) => {
  return <div style={{ color: success ? '#0e9f6e' : '#8780bf' }}> &#183;&#183;&#183;&#183;</div>
}

const TextBridging = styled.div`
  color=#ffffff;
  font-size: 14px;
  lineHeight: 14px; 
  fontWeight: 600;
`

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
  margin: 0px 7px 0px 0px;
`

const TextTo = styled(Link)<{ success: boolean }>`
  color: ${({ success }) => (success ? '#0e9f6e' : '#8780bf')};
  margin: 0px 0px 0px 7px;
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
    <Row>
      <ColumnBridging>
        <TextBridging>
          {value} {assetName}
        </TextBridging>
      </ColumnBridging>
      <ColumnFromTo>
        <Column>
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
        </Column>
        <Column>
          <Dots success={true}></Dots>
          <Dots success={success}></Dots>
        </Column>
        <Column>
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
        </Column>
      </ColumnFromTo>
      <Column>
        <BridgeStatusTag status={status} pendingReason={pendingReason} onCollect={() => onCollect(tx)} />
      </Column>
    </Row>
  )
}
