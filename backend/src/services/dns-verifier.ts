/**
 * DNS Verification Service
 * Verifies custom domain DNS configuration using Cloudflare DNS-over-HTTPS
 */

export interface DNSVerificationResult {
  verified: boolean;
  cnameValid: boolean;
  txtValid: boolean;
  cnameRecords?: string[];
  txtRecords?: string[];
  error?: string;
}

export class DNSVerifier {
  private readonly DOH_ENDPOINT = 'https://cloudflare-dns.com/dns-query';

  /**
   * Verify domain DNS configuration
   */
  async verifyDomain(
    domain: string,
    verificationToken: string,
    expectedCNAME: string = 'affimark.io'
  ): Promise<DNSVerificationResult> {
    try {
      // Check CNAME record
      const cnameResult = await this.queryCNAME(domain);
      const cnameValid = cnameResult.records.some(
        (record) => record.toLowerCase().includes(expectedCNAME.toLowerCase())
      );

      // Check TXT verification record
      const txtDomain = `_affimark-verify.${domain}`;
      const txtResult = await this.queryTXT(txtDomain);
      const txtValid = txtResult.records.some(
        (record) => record.includes(verificationToken)
      );

      return {
        verified: cnameValid && txtValid,
        cnameValid,
        txtValid,
        cnameRecords: cnameResult.records,
        txtRecords: txtResult.records,
      };
    } catch (error: any) {
      console.error('DNS verification error:', error);
      return {
        verified: false,
        cnameValid: false,
        txtValid: false,
        error: error.message || 'DNS lookup failed',
      };
    }
  }

  /**
   * Query CNAME records using DNS-over-HTTPS
   */
  private async queryCNAME(domain: string): Promise<{ records: string[] }> {
    const url = `${this.DOH_ENDPOINT}?name=${domain}&type=CNAME`;

    const response = await fetch(url, {
      headers: {
        Accept: 'application/dns-json',
      },
    });

    if (!response.ok) {
      throw new Error(`DNS query failed: ${response.statusText}`);
    }

    const data: any = await response.json();

    // Extract CNAME records
    const records: string[] = [];
    if (data.Answer) {
      for (const answer of data.Answer) {
        if (answer.type === 5) {
          // CNAME type
          // Remove trailing dot from DNS response
          records.push(answer.data.replace(/\.$/, ''));
        }
      }
    }

    return { records };
  }

  /**
   * Query TXT records using DNS-over-HTTPS
   */
  private async queryTXT(domain: string): Promise<{ records: string[] }> {
    const url = `${this.DOH_ENDPOINT}?name=${domain}&type=TXT`;

    const response = await fetch(url, {
      headers: {
        Accept: 'application/dns-json',
      },
    });

    if (!response.ok) {
      throw new Error(`DNS query failed: ${response.statusText}`);
    }

    const data: any = await response.json();

    // Extract TXT records
    const records: string[] = [];
    if (data.Answer) {
      for (const answer of data.Answer) {
        if (answer.type === 16) {
          // TXT type
          // Remove quotes from TXT record value
          records.push(answer.data.replace(/"/g, ''));
        }
      }
    }

    return { records };
  }

  /**
   * Generate verification token
   */
  static generateVerificationToken(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Validate domain format
   */
  static isValidDomain(domain: string): boolean {
    const domainRegex =
      /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;
    return domainRegex.test(domain);
  }

  /**
   * Check if domain is apex domain (no subdomain)
   */
  static isApexDomain(domain: string): boolean {
    const parts = domain.split('.');
    return parts.length === 2;
  }
}
