import React, { useCallback } from 'react'
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

const TableContainer = styled.div`
  display: flex;
  flex-flow: column;
`

const Body = styled.div`
  flex-flow: column;
  justify-content: space-between;
`

const Row = styled.div`
  display: flex;
  flex-flow: row;
  justify-content: space-between;
  align-items: center;
  padding: 0.25rem 0rem;
  font-weight: 500;
  font-size: 0.825rem;
  color: ${({ theme }) => theme.text5};
`

const Header = styled(Row)`
  font-size: 12px;
  font-weight: 600;
  line-height: 12px;
  text-transform: uppercase;
  color: ${props => props.theme.purple3};
`

const Column = styled.div`
  display: flex;
`

const ColumnBridging = styled(Column)`
  flex: 0 0 25%;
`

const ColumnFrom = styled(Column)`
  justify-content: flex-end;
  flex: 0 0 20%;
`

const ColumnTo = styled(Column)`
  justify-content: flex-end;
  flex: 0 0 35%;
`

const ColumnStatus = styled(Column)`
  flex: 0 0 20%;
  justify-content: flex-end;
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

const TextFrom = styled.div``

const TextTo = styled(Link)<{ success: boolean }>`
  color: ${({ success }) => (success ? '#0e9f6e' : '#8780bf')};
`

const Filler = styled.div`
  display: flex;
  flex-flow: row;
  align-items: center;
  overflow: hidden;
  margin: 0px 7px;
`

const Dots = ({ success }: { success: boolean }) => {
  return (
    <div style={{ overflow: 'hidden', maxWidth: '40%', color: success ? '#0e9f6e' : '#8780bf' }}>
      {' '}
      &#183;&#183;&#183;&#183;&#183;&#183;&#183;&#183;&#183;&#183;
    </div>
  )
}

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
    if (txsFilter !== BridgeTxsFilter.NONE) setTxsFilter(BridgeTxsFilter.NONE)
    else setTxsFilter(BridgeTxsFilter.RECENT)
  }, [setTxsFilter, txsFilter])

  return (
    <>
      <AdvancedDetailsFooter fullWidth padding="12px">
        <TableContainer>
          <Header>
            <ColumnBridging>Bridging</ColumnBridging>
            <ColumnFrom>From</ColumnFrom>
            <ColumnTo>To</ColumnTo>
            <ColumnStatus>Status</ColumnStatus>
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

interface BridgeTransactionsSummaryRow {
  tx: BridgeTransactionSummary
  onCollect: BridgeTransactionsSummaryProps['onCollect']
}

const BridgeTransactionsSummaryRow = ({ tx, onCollect }: BridgeTransactionsSummaryRow) => {
  const { assetName, fromChainId, status, toChainId, value, pendingReason, log } = tx
  const success = status === 'confirmed' || status === 'claimed'

  return (
    <Row>
      <ColumnBridging>
        <TYPE.main color="#ffffff" fontSize="14px" lineHeight="14px" display="inline">
          {value} {assetName}
        </TYPE.main>
      </ColumnBridging>
      <ColumnFrom>
        <TYPE.main color="text4" fontSize="10px" lineHeight="12px" display="inline">
          <TextFrom>
            <Link
              href={getExplorerLink(log[0].chainId, log[0].txHash, 'transaction')}
              rel="noopener noreferrer"
              target="_blank"
            >
              {NETWORK_DETAIL[fromChainId].chainName}
            </Link>
          </TextFrom>
        </TYPE.main>
      </ColumnFrom>
      <ColumnTo>
        <Filler>
          <Dots success={true} />
          <Dots success={success} />
        </Filler>
        <TYPE.main color="text4" fontSize="10px" lineHeight="12px" display="inline">
          <TextTo
            success={success}
            href={log[1] && getExplorerLink(log[1].chainId, log[1].txHash, 'transaction')}
            rel="noopener noreferrer"
            target="_blank"
          >
            {NETWORK_DETAIL[toChainId].chainName}
          </TextTo>
        </TYPE.main>
      </ColumnTo>
      <ColumnStatus>
        <BridgeStatusTag status={status} pendingReason={pendingReason} onCollect={() => onCollect(tx)} />
      </ColumnStatus>
    </Row>
  )
}
