export interface CapacityInput {
  dau?: number;
  readRatio?: number;
  writeRatio?: number;
  avgReadPayloadKb?: number;
  avgWritePayloadKb?: number;
  retentionDays?: number;
  targetLatencyMs?: number;
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

export function calculateCapacity(input: CapacityInput): CapacityResult {
  const dau = input.dau ?? 100000;
  const readRatio = input.readRatio ?? 0.8;
  const writeRatio = input.writeRatio ?? 0.2;
  const readSizeKb = input.avgReadPayloadKb ?? 10;
  const writeSizeKb = input.avgWritePayloadKb ?? 50;
  const days = input.retentionDays ?? 30;
  const latencyMs = input.targetLatencyMs ?? 50;

  const totalOpsPerDay = dau * 10;
  const meanRps = totalOpsPerDay / 86400;
  const peakRps = meanRps * 3;

  const writeOpsPerSec = meanRps * writeRatio;
  const readOpsPerSec = meanRps * readRatio;

  const dailyStorageBytes = writeOpsPerSec * 86400 * writeSizeKb * 1024;
  const dailyStorageGb = dailyStorageBytes / (1024 * 1024 * 1024);
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
    meanRps: Math.round(meanRps * 100) / 100,
    peakRps: Math.round(peakRps * 100) / 100,
    dailyStorageGb: Math.round(dailyStorageGb * 100) / 100,
    totalStorageGb: Math.round(totalStorageGb * 100) / 100,
    readBandwidthMbps: Math.round(readBandwidthMbps * 100) / 100,
    writeBandwidthMbps: Math.round(writeBandwidthMbps * 100) / 100,
    totalBandwidthMbps: Math.round(totalBandwidthMbps * 100) / 100,
    recommendedCacheRamGb,
    recommendedReplicas,
  };
}
