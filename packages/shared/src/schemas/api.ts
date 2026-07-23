import { z } from 'zod';

export const CanvasDataSchema = z.object({
  nodes: z.array(z.unknown()),
  edges: z.array(z.unknown()),
  viewport: z
    .object({
      x: z.number(),
      y: z.number(),
      zoom: z.number(),
    })
    .optional(),
});

export const ApiProjectSchema = z.object({
  id: z.string(),
  userId: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  canvas: CanvasDataSchema,
  thumbnail: z.string().nullable(),
  isPublic: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const ApiUserSchema = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string(),
  avatarUrl: z.string().nullable().optional(),
  provider: z.string().optional(),
  createdAt: z.string(),
});

export const AuthResponseSchema = z.object({
  user: ApiUserSchema,
  token: z.string(),
});

export const ApiErrorSchema = z.object({
  error: z.string(),
  message: z.string(),
  statusCode: z.number(),
});
