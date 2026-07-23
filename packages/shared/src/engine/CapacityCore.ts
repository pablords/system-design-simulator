export interface CapacityInput {
  dau?: number;
  readRatio?: number;
  writeRatio?: number;
  avgReadPayloadKb?: number;
  avgWritePayloadKb?: number;
  retentionDays?: number;
  targetLatencyMs?: number;
  latencyMs?: number;
  peakRps?: number;
  dailyStorageGb?: number;
}

export interface CapacityResult {
  meanRps: number;
  peakRps: number;
  dailyStorageGb: number;
  totalStorageGb: number;
  readBandwidthMbps: number;
  writeBandwidthMbps: number;
  totalBandwidthMbps: number;
  recommendedCacheRamGb: number;
  recommendedReplicas: number;
}

function sanitizeInputMetric(val: unknown, defaultValue: number, min = 0): number {
  if (val === undefined || val === null || typeof val !== 'number' || Number.isNaN(val) || !Number.isFinite(val)) {
    return defaultValue;
  }
  return Math.max(min, val);
}

function sanitizeOutputMetric(val: number, min = 0): number {
  if (Number.isNaN(val) || !Number.isFinite(val)) {
    return min;
  }
  return Math.max(min, val);
}

export function calculateCapacity(input: CapacityInput = {}): CapacityResult {
  const safeInput = input || {};

  const dau = sanitizeInputMetric(safeInput.dau, 100000, 0);
  const readRatio = sanitizeInputMetric(safeInput.readRatio, 0.8, 0);
  const writeRatio = sanitizeInputMetric(safeInput.writeRatio, 0.2, 0);
  const readSizeKb = sanitizeInputMetric(safeInput.avgReadPayloadKb, 10, 0);
  const writeSizeKb = sanitizeInputMetric(safeInput.avgWritePayloadKb, 50, 0);
  const days = sanitizeInputMetric(safeInput.retentionDays, 30, 0);
  const latencyMs = sanitizeInputMetric(safeInput.targetLatencyMs ?? safeInput.latencyMs, 50, 0);

  const totalOpsPerDay = dau * 10;
  const meanRps = totalOpsPerDay / 86400;
  const computedPeakRps = meanRps * 3;
  const peakRps = safeInput.peakRps !== undefined
    ? sanitizeInputMetric(safeInput.peakRps, computedPeakRps, 0)
    : computedPeakRps;

  const writeOpsPerSec = meanRps * writeRatio;
  const readOpsPerSec = meanRps * readRatio;

  const dailyStorageBytes = writeOpsPerSec * 86400 * writeSizeKb * 1024;
  const computedDailyStorageGb = dailyStorageBytes / (1024 * 1024 * 1024);
  const dailyStorageGb = safeInput.dailyStorageGb !== undefined
    ? sanitizeInputMetric(safeInput.dailyStorageGb, computedDailyStorageGb, 0)
    : computedDailyStorageGb;

  const totalStorageGb = dailyStorageGb * days;

  const readBandwidthMbps = (readOpsPerSec * readSizeKb * 8) / 1024;
  const writeBandwidthMbps = (writeOpsPerSec * writeSizeKb * 8) / 1024;
  const totalBandwidthMbps = readBandwidthMbps + writeBandwidthMbps;

  // Pareto rule: 20% of hot data in cache
  const recommendedCacheRamGb = Math.ceil(dailyStorageGb * 0.2);

  // Little's Law: L = lambda * W
  const concurrentReqs = (peakRps * latencyMs) / 1000;
  const recommendedReplicas = Math.max(1, Math.ceil(concurrentReqs / 200));

  return {
    meanRps: sanitizeOutputMetric(Math.round(meanRps * 100) / 100, 0),
    peakRps: sanitizeOutputMetric(Math.round(peakRps * 100) / 100, 0),
    dailyStorageGb: sanitizeOutputMetric(Math.round(dailyStorageGb * 100) / 100, 0),
    totalStorageGb: sanitizeOutputMetric(Math.round(totalStorageGb * 100) / 100, 0),
    readBandwidthMbps: sanitizeOutputMetric(Math.round(readBandwidthMbps * 100) / 100, 0),
    writeBandwidthMbps: sanitizeOutputMetric(Math.round(writeBandwidthMbps * 100) / 100, 0),
    totalBandwidthMbps: sanitizeOutputMetric(Math.round(totalBandwidthMbps * 100) / 100, 0),
    recommendedCacheRamGb: sanitizeOutputMetric(recommendedCacheRamGb, 0),
    recommendedReplicas: sanitizeOutputMetric(recommendedReplicas, 1),
  };
}
