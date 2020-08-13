import { ChainId, Token } from 'dxswap-sdk'
import { defaultTokens } from '../constants'

export interface TokenInfo {
  readonly chainId: number;
  readonly address: string;
  readonly name: string;
  readonly decimals: number;
  readonly symbol: string;
  readonly logoURI?: string;
  readonly tags?: string[];
}

/**
 * Token instances created from token info.
 */
export class WrappedTokenInfo extends Token {
  public readonly tokenInfo: TokenInfo
  constructor(tokenInfo: TokenInfo) {
    super(tokenInfo.chainId, tokenInfo.address, tokenInfo.decimals, tokenInfo.symbol, tokenInfo.name)
    this.tokenInfo = tokenInfo
  }
  public get logoURI(): string | undefined {
    return this.tokenInfo.logoURI
  }
}

export type TokenAddressMap = { [chainId in ChainId]: { [tokenAddress: string]: WrappedTokenInfo } }

/**
 * An empty result, useful as a default.
 */
const EMPTY_LIST: TokenAddressMap = {
  [ChainId.KOVAN]: {},
  [ChainId.RINKEBY]: {},
  [ChainId.ROPSTEN]: {},
  [ChainId.GÖRLI]: {},
  [ChainId.MAINNET]: {}
}

export function tokenListToTokenMap(list: TokenInfo[]): TokenAddressMap {
  let map = EMPTY_LIST
  list.forEach(tokenInfo => {
      const token = new WrappedTokenInfo(tokenInfo)
      if (map[token.chainId][token.address] == undefined)
        map[token.chainId][token.address] = token
  })
  return map
}

export function useDefaultTokenList(): TokenAddressMap {
  return tokenListToTokenMap(defaultTokens)
}
