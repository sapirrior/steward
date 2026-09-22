import { describe, expect, it } from 'bun:test';
import {
  isPrivateIP,
  validateSafeUrl,
} from '../../src/packages/agents/src/tools/web-fetch/index.js';

describe('Web Fetch Tool & SSRF Hardening', () => {
  describe('Private & Reserved IP Detection', () => {
    it('detects private and loopback IPv4 addresses', () => {
      expect(isPrivateIP('127.0.0.1')).toBe(true);
      expect(isPrivateIP('127.0.1.1')).toBe(true);
      expect(isPrivateIP('10.0.0.1')).toBe(true);
      expect(isPrivateIP('10.255.255.255')).toBe(true);
      expect(isPrivateIP('172.16.0.1')).toBe(true);
      expect(isPrivateIP('172.31.255.255')).toBe(true);
      expect(isPrivateIP('192.168.1.1')).toBe(true);
      expect(isPrivateIP('169.254.169.254')).toBe(true); // AWS/cloud metadata
      expect(isPrivateIP('0.0.0.0')).toBe(true);
      expect(isPrivateIP('100.64.0.1')).toBe(true); // Carrier NAT
    });

    it('allows public IPv4 addresses', () => {
      expect(isPrivateIP('8.8.8.8')).toBe(false);
      expect(isPrivateIP('1.1.1.1')).toBe(false);
      expect(isPrivateIP('93.184.216.34')).toBe(false);
    });

    it('detects private and loopback IPv6 addresses', () => {
      expect(isPrivateIP('::1')).toBe(true);
      expect(isPrivateIP('::')).toBe(true);
      expect(isPrivateIP('fe80::1')).toBe(true);
      expect(isPrivateIP('fc00::1')).toBe(true);
      expect(isPrivateIP('fd00::1')).toBe(true);
      expect(isPrivateIP('::ffff:127.0.0.1')).toBe(true);
      expect(isPrivateIP('::ffff:169.254.169.254')).toBe(true);
    });
  });

  describe('URL Safety Validation', () => {
    it('rejects non-http/https protocols', async () => {
      await expect(validateSafeUrl('file:///etc/passwd')).rejects.toThrow(/Forbidden protocol/);
      await expect(validateSafeUrl('ftp://example.com')).rejects.toThrow(/Forbidden protocol/);
      await expect(validateSafeUrl('gopher://example.com')).rejects.toThrow(/Forbidden protocol/);
    });

    it('rejects localhost, .local, and internal hostnames', async () => {
      await expect(validateSafeUrl('http://localhost:8080/')).rejects.toThrow(
        /blocked for security/,
      );
      await expect(validateSafeUrl('http://myserver.local/test')).rejects.toThrow(
        /blocked for security/,
      );
      await expect(validateSafeUrl('http://service.internal/')).rejects.toThrow(
        /blocked for security/,
      );
    });

    it('rejects direct private IP literals and cloud metadata endpoint', async () => {
      await expect(validateSafeUrl('http://169.254.169.254/latest/meta-data/')).rejects.toThrow(
        /blocked for security/,
      );
      await expect(validateSafeUrl('http://127.0.0.1:9000/')).rejects.toThrow(
        /blocked for security/,
      );
      await expect(validateSafeUrl('http://192.168.1.100/admin')).rejects.toThrow(
        /blocked for security/,
      );
      await expect(validateSafeUrl('http://10.0.0.5/')).rejects.toThrow(/blocked for security/);
    });
  });
});
