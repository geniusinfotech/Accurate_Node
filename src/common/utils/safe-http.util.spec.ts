import { assertFetchableUrl, isBlockedAddress } from './safe-http.util';

describe('outbound request guard (SSRF)', () => {
  it.each([
    '127.0.0.1', '10.1.2.3', '172.16.5.5', '172.31.255.255', '192.168.1.1', '169.254.169.254',
    '100.64.0.1', '0.0.0.0', '::1', 'fd00::1', 'fe80::1', '::ffff:127.0.0.1', '::ffff:169.254.169.254',
  ])('blocks %s', (ip) => expect(isBlockedAddress(ip)).toBe(true));

  it.each(['8.8.8.8', '1.1.1.1', '172.32.0.1', '2606:4700:4700::1111'])('allows public %s', (ip) =>
    expect(isBlockedAddress(ip)).toBe(false),
  );

  it('rejects odd spellings of internal hosts and non-http schemes', () => {
    for (const bad of ['http://localhost/x', 'http://127.1/x', 'http://0x7f.0.0.1/x', 'http://2130706433/x',
      'http://[::1]/x', 'http://169.254.169.254/latest/meta-data', 'file:///etc/passwd', 'ftp://example.com/a']) {
      expect(() => assertFetchableUrl(bad)).toThrow();
    }
    expect(assertFetchableUrl('https://example.com/a.png').hostname).toBe('example.com');
  });
});
