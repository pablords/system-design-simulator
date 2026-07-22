import * as jose from 'jose';
import { env } from '../config/env.js';

const secret = new TextEncoder().encode(env.JWT_SECRET);
const ALG = 'HS256';

function parseDuration(duration: string): string {
  return duration;
}

export async function signToken(userId: string): Promise<string> {
  return new jose.SignJWT({ userId })
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setExpirationTime(parseDuration(env.JWT_EXPIRY))
    .sign(secret);
}

export async function verifyToken(token: string): Promise<{ userId: string }> {
  const { payload } = await jose.jwtVerify(token, secret, {
    algorithms: [ALG],
  });

  if (typeof payload.userId !== 'string') {
    throw new Error('Invalid token payload');
  }

  return { userId: payload.userId };
}
