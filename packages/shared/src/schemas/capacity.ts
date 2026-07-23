import { z } from 'zod';

export const CapacityInputSchema = z.object({
  dau: z.number().optional(),
  readRatio: z.number().optional(),
  writeRatio: z.number().optional(),
  avgReadPayloadKb: z.number().optional(),
  avgWritePayloadKb: z.number().optional(),
  retentionDays: z.number().optional(),
  targetLatencyMs: z.number().optional(),
});

export const CapacityResultSchema = z.object({
  meanRps: z.number(),
  peakRps: z.number(),
  dailyStorageGb: z.number(),
  totalStorageGb: z.number(),
  readBandwidthMbps: z.number(),
  writeBandwidthMbps: z.number(),
  totalBandwidthMbps: z.number(),
  recommendedCacheRamGb: z.number(),
  recommendedReplicas: z.number(),
});
