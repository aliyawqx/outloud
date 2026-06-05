import { describe, it, expect } from 'vitest'
import { fetchSampleFromUrl, UrlFetchError } from './fetchUrl'

// These cases are rejected before any network call (bad protocol, or a literal
// private/reserved IP host), so the tests are hermetic.
describe('fetchSampleFromUrl SSRF guards', () => {
  it('rejects non-http(s) protocols', async () => {
    await expect(fetchSampleFromUrl('ftp://example.com/x')).rejects.toThrow(UrlFetchError)
    await expect(fetchSampleFromUrl('file:///etc/passwd')).rejects.toThrow(UrlFetchError)
  })

  it('rejects loopback / private / link-local / metadata IP literals (v4 + v6)', async () => {
    const blocked = [
      'http://127.0.0.1/',
      'http://10.0.0.5/',
      'http://172.16.0.1/',
      'http://192.168.1.1/',
      'http://169.254.169.254/', // cloud metadata
      'http://100.64.0.1/', // CGNAT
      'http://0.0.0.0/',
      'http://[::1]/',
      'http://[fd00::1]/', // unique-local
      'http://[fe80::1]/', // link-local
    ]
    for (const u of blocked) {
      await expect(fetchSampleFromUrl(u), u).rejects.toThrow(UrlFetchError)
    }
  })

  it('rejects an invalid URL', async () => {
    await expect(fetchSampleFromUrl('not a url')).rejects.toThrow(UrlFetchError)
  })
})
