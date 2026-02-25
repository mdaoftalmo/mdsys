// apps/backend/src/__tests__/dedupe.spec.ts
import { createHash } from 'crypto';

/**
 * Tests for file deduplication via SHA-256 hash.
 * This tests the concept — actual DB constraint is in migration.
 */

function computeFileHash(content: Buffer | string): string {
  return createHash('sha256')
    .update(typeof content === 'string' ? Buffer.from(content) : content)
    .digest('hex');
}

function computeTransactionFingerprint(tx: {
  date: string; description: string; value: number; reference?: string;
}): string {
  const raw = `${tx.date}|${tx.description}|${tx.value}|${tx.reference || ''}`;
  return createHash('sha256').update(raw).digest('hex');
}

describe('File Hash Deduplication', () => {
  it('produces consistent hash for same content', () => {
    const content = 'OFXHEADER:100\nDATA:OFXSGML';
    expect(computeFileHash(content)).toBe(computeFileHash(content));
  });

  it('produces different hash for different content', () => {
    const a = computeFileHash('file-a-content');
    const b = computeFileHash('file-b-content');
    expect(a).not.toBe(b);
  });

  it('hash is 64 chars hex (SHA-256)', () => {
    const hash = computeFileHash('test');
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });
});

describe('Transaction Fingerprint Deduplication', () => {
  it('same transaction data produces same fingerprint', () => {
    const tx = { date: '2026-02-01', description: 'PIX RECEB', value: 350 };
    expect(computeTransactionFingerprint(tx)).toBe(computeTransactionFingerprint(tx));
  });

  it('different values produce different fingerprints', () => {
    const a = computeTransactionFingerprint({ date: '2026-02-01', description: 'PIX', value: 350 });
    const b = computeTransactionFingerprint({ date: '2026-02-01', description: 'PIX', value: 351 });
    expect(a).not.toBe(b);
  });

  it('reference is included in fingerprint', () => {
    const base = { date: '2026-02-01', description: 'TED', value: 1500 };
    const withRef = { ...base, reference: 'DOC-123' };
    expect(computeTransactionFingerprint(base)).not.toBe(computeTransactionFingerprint(withRef));
  });
});
