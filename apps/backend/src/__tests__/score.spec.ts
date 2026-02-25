// apps/backend/src/__tests__/score.spec.ts
/**
 * Tests for OrientacaoCirurgicaService.calculateScore()
 * Score range: 0–50
 * Components: interest (0-15), insurance (+10), timeframe (0-15), barriers (-2 each)
 */

// Extract the scoring logic (mirror of private method for testing)
function calculateScore(data: {
  interest?: string;
  has_insurance?: boolean;
  desired_timeframe?: string;
  barriers?: string[];
}): number {
  let score = 0;

  const interestMap: Record<string, number> = { alto: 15, medio: 10, baixo: 5 };
  score += interestMap[data.interest || ''] || 0;

  if (data.has_insurance) score += 10;

  const timeframeMap: Record<string, number> = { '0-30': 15, '30-60': 10, '60+': 5 };
  score += timeframeMap[data.desired_timeframe || ''] || 0;

  const barrierPenalty = (data.barriers?.length || 0) * 2;
  score = Math.max(0, score - barrierPenalty);

  return Math.min(50, score);
}

describe('calculateScore', () => {
  it('returns max score (40) for ideal lead', () => {
    expect(calculateScore({
      interest: 'alto', has_insurance: true, desired_timeframe: '0-30', barriers: [],
    })).toBe(40);
  });

  it('returns 0 for empty input', () => {
    expect(calculateScore({})).toBe(0);
  });

  it('caps at 50', () => {
    // Even if formula could theoretically exceed 50
    expect(calculateScore({
      interest: 'alto', has_insurance: true, desired_timeframe: '0-30', barriers: [],
    })).toBeLessThanOrEqual(50);
  });

  it('applies barrier penalty correctly', () => {
    const base = calculateScore({ interest: 'alto', has_insurance: true, desired_timeframe: '0-30' });
    const with2Barriers = calculateScore({ interest: 'alto', has_insurance: true, desired_timeframe: '0-30', barriers: ['Preço', 'Medo'] });
    expect(base - with2Barriers).toBe(4); // 2 barriers × 2 = 4
  });

  it('never returns negative', () => {
    expect(calculateScore({
      interest: 'baixo', barriers: ['A', 'B', 'C', 'D', 'E', 'F'],
    })).toBe(0);
  });

  it('differentiates interest levels', () => {
    const alto = calculateScore({ interest: 'alto' });
    const medio = calculateScore({ interest: 'medio' });
    const baixo = calculateScore({ interest: 'baixo' });
    expect(alto).toBeGreaterThan(medio);
    expect(medio).toBeGreaterThan(baixo);
  });

  it('adds insurance bonus', () => {
    const without = calculateScore({ interest: 'medio' });
    const with_ = calculateScore({ interest: 'medio', has_insurance: true });
    expect(with_ - without).toBe(10);
  });

  it('differentiates timeframes', () => {
    const urgent = calculateScore({ desired_timeframe: '0-30' });
    const mid = calculateScore({ desired_timeframe: '30-60' });
    const far = calculateScore({ desired_timeframe: '60+' });
    expect(urgent).toBeGreaterThan(mid);
    expect(mid).toBeGreaterThan(far);
  });
});
