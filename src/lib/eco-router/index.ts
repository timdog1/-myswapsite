import { Signer } from '@ethersproject/abstract-signer'
import { Provider } from '@ethersproject/providers'

/**
 * The EcoRouter finds the cheapest path among many DEXs
 *
 */
export class EcoRouter {
  private providerOrSigner: Provider | Signer

  constructor(providerOrSigner: Provider | Signer) {
    this.providerOrSigner = providerOrSigner
  }

  public getProvider() {
    return this.providerOrSigner
  }
}
