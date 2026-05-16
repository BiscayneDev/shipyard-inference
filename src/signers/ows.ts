export interface OWSClientConfig {
  endpoint: string
  apiKey: string
}

export interface OWSResponse<T = unknown> {
  ok: boolean
  data?: T
  error?: string
}

/**
 * Open Wallet Standard HTTP daemon client.
 *
 * Talks to a local OWS daemon (default http://localhost:8787) with Bearer
 * auth. Keys never leave the daemon. See https://openwallet.sh for setup.
 */
export class OWSClient {
  private endpoint: string
  private apiKey: string

  constructor(config: OWSClientConfig) {
    this.endpoint = config.endpoint.replace(/\/+$/, '')
    this.apiKey = config.apiKey
  }

  async request<T = unknown>(
    method: string,
    path: string,
    body?: Record<string, unknown>
  ): Promise<OWSResponse<T>> {
    try {
      const response = await fetch(`${this.endpoint}${path}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: body ? JSON.stringify(body) : undefined,
      })

      if (!response.ok) {
        const text = await response.text()
        return {
          ok: false,
          error: `OWS API error (${response.status}): ${text}`,
        }
      }

      const data = (await response.json()) as T
      return { ok: true, data }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return { ok: false, error: `Failed to connect to OWS: ${message}` }
    }
  }

  async listWallets(): Promise<OWSResponse> {
    return this.request('GET', '/v1/wallets')
  }

  async getWallet(walletId: string): Promise<OWSResponse> {
    return this.request('GET', `/v1/wallets/${walletId}`)
  }

  async listAccounts(walletId: string): Promise<OWSResponse> {
    return this.request('GET', `/v1/wallets/${walletId}/accounts`)
  }

  async getBalance(
    accountId: string,
    chainId: string
  ): Promise<OWSResponse> {
    return this.request(
      'GET',
      `/v1/accounts/${accountId}/balance?chain=${chainId}`
    )
  }

  async signMessage(
    walletId: string,
    chainId: string,
    message: string
  ): Promise<OWSResponse> {
    return this.request('POST', `/v1/wallets/${walletId}/sign-message`, {
      chain: chainId,
      message,
    })
  }

  async signTransaction(
    walletId: string,
    chainId: string,
    transaction: Record<string, unknown>
  ): Promise<OWSResponse> {
    return this.request('POST', `/v1/wallets/${walletId}/sign`, {
      chain: chainId,
      transaction,
    })
  }

  async signAndSend(
    walletId: string,
    chainId: string,
    transaction: Record<string, unknown>
  ): Promise<OWSResponse> {
    return this.request('POST', `/v1/wallets/${walletId}/sign-and-send`, {
      chain: chainId,
      transaction,
    })
  }

  async simulate(
    walletId: string,
    chainId: string,
    transaction: Record<string, unknown>
  ): Promise<OWSResponse> {
    return this.request('POST', `/v1/wallets/${walletId}/simulate`, {
      chain: chainId,
      transaction,
    })
  }
}
