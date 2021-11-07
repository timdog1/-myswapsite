import { Provider } from '@ethersproject/providers'
import { Contract } from 'ethers'

import ADDRESS_PROVIDER_ABI from './abi/address_provider.json'
// import GaugeControllerABI from './abi/gaugecontroller.json'
// import VotingEscrowABI from './abi/votingescrow.json'
import CURVE_ROUTER_ABI from './abi/router.json'
import ERC20_ABI from './abi/ERC20.json'
// Constants

export const MAINNET_CONTRACTS = {
  crv: '0xD533a949740bb3306d119CC777fa900bA034cd52',
  addressProvider: '0x0000000022d53366457f9d5e68ec105046fc4383',
  router: '0xfA9a30350048B2BF66865ee20363067c66f67e58'

  // ignore for
  /*
  poolProxy: '0xeCb456EA5365865EbAb8a2661B0c503410e9B347',
  feeDistributor: '0xA464e6DCda8AC41e03616F95f4BC98a13b8922Dc',
  minter: '0xd061D61a4d941c39E5453435B6345Dc261C2fcE0',
  votingEscrow: '0x5f3b5DfEb7B28CDbD7FAba78963EE202a494e2A2',
  gaugeController: '0x2F50D538606Fa9EDD2B11E2446BEb18C9D5846bB',
  gaugeProxy: '0x519AFB566c05E00cfB9af73496D00217A630e4D5',

  */
} as const

/**
 * CurveFi Router address for each Supported ChainId
 *
 */
export const ALIASES = {
  1: MAINNET_CONTRACTS
}

export type CoreContracts = Record<keyof typeof MAINNET_CONTRACTS, Contract>

/**
 *
 * @param providerOrSigner
 * @returns
 */
export async function getContracts(providerOrSigner: Provider): Promise<CoreContracts> {
  // Fetch networId and router address and connect to the contract
  const chainId = (await providerOrSigner.getNetwork()).chainId as keyof typeof ALIASES

  return {
    crv: new Contract(ALIASES[chainId].crv, ERC20_ABI, providerOrSigner),
    addressProvider: new Contract(ALIASES[chainId].addressProvider, ADDRESS_PROVIDER_ABI, providerOrSigner),
    router: new Contract(ALIASES[chainId].router, CURVE_ROUTER_ABI, providerOrSigner)
  }
}
