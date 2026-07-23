import { describe, it, expect } from 'vitest';
import { calculateCapacity, CapacityInputSchema, CapacityResultSchema } from '../index.js';

describe('CapacityCore - calculateCapacity', () => {
  it('should calculate default capacity parameters when input is empty', () => {
    const result = calculateCapacity({});

    expect(result.meanRps).toBe(11.57);
    expect(result.peakRps).toBe(34.72);
    expect(result.dailyStorageGb).toBe(9.54);
    expect(result.totalStorageGb).toBe(286.1);
    expect(result.readBandwidthMbps).toBe(0.72);
    expect(result.writeBandwidthMbps).toBe(0.9);
    expect(result.totalBandwidthMbps).toBe(1.63);
    expect(result.recommendedCacheRamGb).toBe(2);
    expect(result.recommendedReplicas).toBe(1);

    // Validate schema
    const parsed = CapacityResultSchema.safeParse(result);
    expect(parsed.success).toBe(true);
  });

  it('should calculate capacity correctly with custom high-traffic parameters', () => {
    const customInput = {
      dau: 10_000_000,
      readRatio: 0.9,
      writeRatio: 0.1,
      avgReadPayloadKb: 20,
      avgWritePayloadKb: 100,
      retentionDays: 90,
      targetLatencyMs: 200,
    };

    // Validate input schema
    const inputParsed = CapacityInputSchema.safeParse(customInput);
    expect(inputParsed.success).toBe(true);

    const result = calculateCapacity(customInput);

    // 10M DAU => 100M ops/day => meanRps = 1157.41, peakRps = 3472.22
    expect(result.meanRps).toBe(1157.41);
    expect(result.peakRps).toBe(3472.22);
    expect(result.dailyStorageGb).toBe(953.67);
    expect(result.totalStorageGb).toBe(85830.69);
    expect(result.readBandwidthMbps).toBe(162.76);
    expect(result.writeBandwidthMbps).toBe(90.42);
    expect(result.totalBandwidthMbps).toBe(253.18);
    expect(result.recommendedCacheRamGb).toBe(191);

    // Concurrent reqs: (3472.22 * 200) / 1000 = 694.44 reqs
    // Recommended replicas: Math.ceil(694.44 / 200) = 4 replicas
    expect(result.recommendedReplicas).toBe(4);
  });

  it('should scale recommended replicas properly according to Little’s Law L = lambda * W', () => {
    const extremeInput = {
      dau: 50_000_000, // 500M ops/day => meanRps = 5787.04, peakRps = 17361.11
      targetLatencyMs: 500, // 0.5s => L = 8680.55 concurrent requests
    };

    const result = calculateCapacity(extremeInput);

    // Math.ceil(8680.55 / 200) = 44 replicas
    expect(result.recommendedReplicas).toBe(44);
    expect(result.recommendedCacheRamGb).toBeGreaterThan(0);
  });
});
