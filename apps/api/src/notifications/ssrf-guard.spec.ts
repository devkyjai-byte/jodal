import {
  isPrivateOrReservedLiteralHost,
  assertPushEndpointResolvesSafe,
  UnsafePushEndpointError,
} from './ssrf-guard';

jest.mock('node:dns', () => ({
  promises: { lookup: jest.fn() },
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { promises: dnsPromises } = jest.requireMock('node:dns') as {
  promises: { lookup: jest.Mock };
};

describe('ssrf-guard (T-02-21)', () => {
  describe('isPrivateOrReservedLiteralHost', () => {
    it.each([
      ['169.254.169.254', true], // 클라우드 메타데이터 엔드포인트
      ['10.0.0.5', true],
      ['172.16.0.1', true],
      ['192.168.1.1', true],
      ['127.0.0.1', true],
      ['0.0.0.0', true],
      ['::1', true],
      ['fe80::1', true],
      ['fc00::1', true],
      ['::ffff:10.0.0.5', true], // IPv4-mapped IPv6
      ['1.2.3.4', false], // 공개 IP
      ['8.8.8.8', false],
      ['2001:4860:4860::8888', false], // 공개 IPv6 (Google DNS)
    ])('%s → private/reserved=%s', (host, expected) => {
      expect(isPrivateOrReservedLiteralHost(host)).toBe(expected);
    });

    it('도메인(리터럴 IP 아님)은 false를 반환한다 — 이 함수의 검사 대상이 아님', () => {
      expect(isPrivateOrReservedLiteralHost('push.example.com')).toBe(false);
    });
  });

  describe('assertPushEndpointResolvesSafe', () => {
    beforeEach(() => {
      dnsPromises.lookup.mockReset();
    });

    it('리터럴 사설 IP 호스트는 DNS 조회 없이 즉시 거부한다', async () => {
      await expect(
        assertPushEndpointResolvesSafe('https://169.254.169.254/latest/meta'),
      ).rejects.toBeInstanceOf(UnsafePushEndpointError);
      expect(dnsPromises.lookup).not.toHaveBeenCalled();
    });

    it('공개 리터럴 IP 호스트는 통과한다', async () => {
      await expect(
        assertPushEndpointResolvesSafe('https://1.2.3.4/push'),
      ).resolves.toBeUndefined();
    });

    it('도메인이 공개 IP로만 해석되면 통과한다', async () => {
      dnsPromises.lookup.mockResolvedValue([
        { address: '35.190.1.1', family: 4 },
      ]);
      await expect(
        assertPushEndpointResolvesSafe('https://push.example.com/1'),
      ).resolves.toBeUndefined();
      expect(dnsPromises.lookup).toHaveBeenCalledWith('push.example.com', {
        all: true,
        verbatim: true,
      });
    });

    it('도메인이 사설 IP로 리바인딩되어 있으면 거부한다(DNS rebinding)', async () => {
      dnsPromises.lookup.mockResolvedValue([
        { address: '169.254.169.254', family: 4 },
      ]);
      await expect(
        assertPushEndpointResolvesSafe('https://evil.example.com/1'),
      ).rejects.toBeInstanceOf(UnsafePushEndpointError);
    });

    it('여러 해석 결과 중 하나라도 사설 IP면 거부한다', async () => {
      dnsPromises.lookup.mockResolvedValue([
        { address: '35.190.1.1', family: 4 },
        { address: '127.0.0.1', family: 4 },
      ]);
      await expect(
        assertPushEndpointResolvesSafe('https://mixed.example.com/1'),
      ).rejects.toBeInstanceOf(UnsafePushEndpointError);
    });
  });
});
