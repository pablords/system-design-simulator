import { describe, it, expect } from 'vitest';
import { signToken, verifyToken } from '../lib/jwt.js';

describe('JWT Utilities', () => {
  it('should sign and verify valid JWT token', async () => {
    const userId = 'user_abc123';
    const token = await signToken(userId);

    expect(typeof token).toBe('string');
    expect(token.split('.')).toHaveLength(3);

    const payload = await verifyToken(token);
    expect(payload.userId).toBe(userId);
  });

  it('should throw error when verifying invalid or tampered token', async () => {
    await expect(verifyToken('invalid.jwt.token')).rejects.toThrow();
  });
});
