import { describe, it, expect } from 'vitest';
import { calculateCapacity } from '../engine/CapacityCore.js';

describe('CapacityCore Empirical Stress Tests', () => {
  it('handles DAU scaling from 1 to 1 Billion without NaN or Infinity', () => {
    const daus = [1, 10, 100, 1_000, 10_000, 100_000, 1_000_000, 10_000_000, 100_000_000, 1_000_000_000];

    for (const dau of daus) {
      const res = calculateCapacity({ dau });

      expect(Number.isNaN(res.meanRps)).toBe(false);
      expect(Number.isNaN(res.peakRps)).toBe(false);
      expect(Number.isNaN(res.dailyStorageGb)).toBe(false);
      expect(Number.isNaN(res.totalStorageGb)).toBe(false);
      expect(Number.isNaN(res.readBandwidthMbps)).toBe(false);
      expect(Number.isNaN(res.writeBandwidthMbps)).toBe(false);
      expect(Number.isNaN(res.totalBandwidthMbps)).toBe(false);
      expect(Number.isNaN(res.recommendedCacheRamGb)).toBe(false);
      expect(Number.isNaN(res.recommendedReplicas)).toBe(false);

      expect(Number.isFinite(res.meanRps)).toBe(true);
      expect(Number.isFinite(res.peakRps)).toBe(true);
      expect(Number.isFinite(res.dailyStorageGb)).toBe(true);
      expect(Number.isFinite(res.totalStorageGb)).toBe(true);
      expect(Number.isFinite(res.readBandwidthMbps)).toBe(true);
      expect(Number.isFinite(res.writeBandwidthMbps)).toBe(true);
      expect(Number.isFinite(res.totalBandwidthMbps)).toBe(true);
      expect(Number.isFinite(res.recommendedCacheRamGb)).toBe(true);
      expect(Number.isFinite(res.recommendedReplicas)).toBe(true);

      expect(res.recommendedReplicas).toBeGreaterThanOrEqual(1);
      expect(res.meanRps).toBeGreaterThanOrEqual(0);
    }
  });

  it('handles latency scaling from 1ms to 60s (60000ms)', () => {
    const latencies = [1, 5, 10, 50, 100, 500, 1000, 5000, 10000, 60000];

    for (const targetLatencyMs of latencies) {
      const res = calculateCapacity({ dau: 10_000_000, targetLatencyMs });

      expect(Number.isNaN(res.recommendedReplicas)).toBe(false);
      expect(Number.isFinite(res.recommendedReplicas)).toBe(true);
      expect(res.recommendedReplicas).toBeGreaterThanOrEqual(1);
    }
  });

  it('handles payload scaling from 1 Byte (0.0009765625 KB) to 100 MB (100000 KB)', () => {
    const payloads = [0.0009765625, 0.1, 1, 10, 100, 1000, 10000, 100000];

    for (const payloadKb of payloads) {
      const res = calculateCapacity({
        dau: 1_000_000,
        avgReadPayloadKb: payloadKb,
        avgWritePayloadKb: payloadKb,
      });

      expect(Number.isNaN(res.dailyStorageGb)).toBe(false);
      expect(Number.isFinite(res.dailyStorageGb)).toBe(true);
      expect(res.dailyStorageGb).toBeGreaterThanOrEqual(0);

      expect(Number.isNaN(res.totalBandwidthMbps)).toBe(false);
      expect(Number.isFinite(res.totalBandwidthMbps)).toBe(true);
      expect(res.totalBandwidthMbps).toBeGreaterThanOrEqual(0);
    }
  });

  it('evaluates behavior on boundary & invalid inputs (0, negative, NaN, Infinity)', () => {
    const zeroRes = calculateCapacity({ dau: 0, targetLatencyMs: 0, avgReadPayloadKb: 0, avgWritePayloadKb: 0 });
    expect(zeroRes.meanRps).toBe(0);
    expect(zeroRes.recommendedReplicas).toBe(1);

    const nanRes = calculateCapacity({ dau: NaN, targetLatencyMs: NaN });
    console.log('NaN input result:', nanRes);

    const infRes = calculateCapacity({ dau: Infinity, targetLatencyMs: Infinity });
    console.log('Infinity input result:', infRes);

    const negRes = calculateCapacity({ dau: -1000, targetLatencyMs: -50 });
    console.log('Negative input result:', negRes);
  });

  it('runs performance benchmark for calculateCapacity (100,000 iterations)', () => {
    const start = performance.now();
    const iterations = 100_000;

    for (let i = 0; i < iterations; i++) {
      calculateCapacity({
        dau: 1_000_000 + (i % 1000),
        readRatio: 0.8,
        writeRatio: 0.2,
        avgReadPayloadKb: 10 + (i % 50),
        avgWritePayloadKb: 50 + (i % 100),
        retentionDays: 30,
        targetLatencyMs: 50 + (i % 200),
      });
    }

    const durationMs = performance.now() - start;
    const opsPerSec = Math.round((iterations / durationMs) * 1000);
    console.log(`[Benchmark] CapacityCore: ${iterations} iterations in ${durationMs.toFixed(2)}ms (${opsPerSec.toLocaleString()} ops/sec)`);
    expect(durationMs).toBeLessThan(5000); // Must complete within 5s
  });
});
