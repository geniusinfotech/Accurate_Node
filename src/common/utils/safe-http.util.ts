import * as dns from 'dns';
import * as http from 'http';
import * as https from 'https';
import * as net from 'net';

/**
 * Outbound-request guard (SSRF). Admin features that fetch a user-supplied URL
 * must never reach this server's own network: loopback, private ranges, cloud
 * metadata (169.254.169.254), etc. The check happens when the socket connects,
 * on the addresses the name really resolves to, so DNS tricks don't bypass it,
 * and callers must not follow redirects (maxRedirects: 0).
 */
const blocked = new net.BlockList();
for (const [net4, prefix] of [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4],
] as [string, number][]) {
  blocked.addSubnet(net4, prefix, 'ipv4');
}
blocked.addAddress('::', 'ipv6');
blocked.addAddress('::1', 'ipv6');
blocked.addSubnet('fc00::', 7, 'ipv6'); // unique-local
blocked.addSubnet('fe80::', 10, 'ipv6'); // link-local
blocked.addSubnet('ff00::', 8, 'ipv6'); // multicast

/** True when the IP is private/internal and must not be fetched. */
export function isBlockedAddress(ip: string): boolean {
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(ip); // IPv4-in-IPv6
  const addr = mapped ? mapped[1] : ip;
  const family = net.isIP(addr);
  if (family === 0) return true; // not an IP at all: refuse
  return blocked.check(addr, family === 6 ? 'ipv6' : 'ipv4');
}

function guardedLookup(
  hostname: string,
  options: dns.LookupOptions,
  callback: (err: NodeJS.ErrnoException | null, address: any, family?: number) => void,
) {
  dns.lookup(hostname, { ...options, all: true }, (err, addresses) => {
    if (err) return callback(err, '', 0);
    const list = addresses as dns.LookupAddress[];
    const bad = list.find((a) => isBlockedAddress(a.address));
    if (bad) {
      return callback(new Error(`Blocked internal address for ${hostname}`) as NodeJS.ErrnoException, '', 0);
    }
    return options.all ? callback(null, list) : callback(null, list[0].address, list[0].family);
  });
}

/** Axios options for fetching an untrusted URL. */
export function untrustedFetchOptions() {
  return {
    httpAgent: new http.Agent({ lookup: guardedLookup as any }),
    httpsAgent: new https.Agent({ lookup: guardedLookup as any }),
    maxRedirects: 0,
  };
}

/** Throws unless the URL is plain http(s) and, if it names an IP directly, a public one. */
export function assertFetchableUrl(raw: string): URL {
  const url = new URL(raw);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('Only http(s) URLs are allowed');
  }
  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (host === 'localhost' || host.endsWith('.localhost')) throw new Error('Blocked internal host');
  if (net.isIP(host) && isBlockedAddress(host)) throw new Error('Blocked internal address');
  return url;
}
