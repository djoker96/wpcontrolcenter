import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

/**
 * SSRF guard. Validates that a user-supplied URL points at a public host before
 * the server fetches it, blocking access to loopback / private / link-local /
 * cloud-metadata ranges.
 *
 * Escape hatch: set WPCC_ALLOW_PRIVATE_TARGETS=true to permit private targets
 * (needed for on-prem deployments that manage WordPress sites on internal IPs).
 */

function allowPrivate(): boolean {
  return process.env.WPCC_ALLOW_PRIVATE_TARGETS === 'true';
}

/** Returns true if the given IP literal is in a blocked (non-public) range. */
export function isPrivateIp(ip: string): boolean {
  const v = isIP(ip);
  if (v === 4) {
    const p = ip.split('.').map(Number);
    if (p.length !== 4 || p.some((n) => Number.isNaN(n))) return true; // malformed → treat as unsafe
    const [a, b] = p;
    if (a === 10) return true; // 10.0.0.0/8
    if (a === 127) return true; // loopback
    if (a === 0) return true; // 0.0.0.0/8
    if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
    if (a === 192 && b === 168) return true; // 192.168.0.0/16
    if (a === 169 && b === 254) return true; // link-local + 169.254.169.254 metadata
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT 100.64.0.0/10
    if (a >= 224) return true; // multicast / reserved
    return false;
  }
  if (v === 6) {
    const lower = ip.toLowerCase();
    if (lower === '::1' || lower === '::') return true; // loopback / unspecified
    if (lower.startsWith('fe80')) return true; // link-local
    if (lower.startsWith('fc') || lower.startsWith('fd')) return true; // unique-local fc00::/7
    if (lower.startsWith('::ffff:')) return isPrivateIp(lower.replace('::ffff:', '')); // IPv4-mapped
    return false;
  }
  return true; // not a valid IP literal → unsafe
}

/**
 * Throws if `rawUrl` is not a safe public http(s) target. Resolves DNS and
 * checks every resolved address.
 */
export async function assertPublicUrl(rawUrl: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error('Invalid URL');
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(`Blocked URL scheme: ${url.protocol}`);
  }
  // Reject embedded credentials (http://user:pass@host).
  if (url.username || url.password) {
    throw new Error('Blocked URL with embedded credentials');
  }

  if (allowPrivate()) {
    return url;
  }

  const hostname = url.hostname.replace(/^\[|\]$/g, ''); // strip IPv6 brackets

  const blockedHostnames = ['localhost', 'metadata.google.internal'];
  if (blockedHostnames.includes(hostname.toLowerCase()) || hostname.toLowerCase().endsWith('.internal') || hostname.toLowerCase().endsWith('.local')) {
    throw new Error('Blocked internal hostname');
  }

  // Literal IP in the URL.
  if (isIP(hostname)) {
    if (isPrivateIp(hostname)) {
      throw new Error('Blocked private/reserved IP address');
    }
    return url;
  }

  // Resolve DNS and verify every address is public (mitigates DNS rebinding at fetch time).
  let addresses: { address: string }[];
  try {
    addresses = await lookup(hostname, { all: true });
  } catch {
    throw new Error('DNS resolution failed for target host');
  }
  if (addresses.length === 0 || addresses.some((a) => isPrivateIp(a.address))) {
    throw new Error('Target host resolves to a private/reserved address');
  }

  return url;
}
