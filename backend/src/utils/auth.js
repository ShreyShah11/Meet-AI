import crypto from 'crypto';
import { config } from '../config/env.js';

const TOKEN_VERSION = 1;

const base64UrlEncode = (value) => {
  const input = typeof value === 'string' ? value : JSON.stringify(value);
  return Buffer.from(input).toString('base64url');
};

const base64UrlDecode = (value) => {
  return Buffer.from(value, 'base64url').toString('utf8');
};

export const hashPassword = (password) => {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
};

export const verifyPassword = (password, storedHash) => {
  if (!password || !storedHash || !storedHash.includes(':')) return false;

  const [salt, hash] = storedHash.split(':');
  const candidate = crypto.scryptSync(password, salt, 64);
  const original = Buffer.from(hash, 'hex');

  if (candidate.length !== original.length) return false;
  return crypto.timingSafeEqual(candidate, original);
};

export const signToken = (payload) => {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const tokenPayload = {
    ...payload,
    iat: now,
    exp: now + config.auth.jwtExpiresInSeconds,
    v: TOKEN_VERSION
  };

  const body = `${base64UrlEncode(header)}.${base64UrlEncode(tokenPayload)}`;
  const signature = crypto
    .createHmac('sha256', config.auth.jwtSecret)
    .update(body)
    .digest('base64url');

  return `${body}.${signature}`;
};

export const verifyToken = (token) => {
  if (!token || typeof token !== 'string') return null;

  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [encodedHeader, encodedPayload, signature] = parts;
  const body = `${encodedHeader}.${encodedPayload}`;
  const expectedSignature = crypto
    .createHmac('sha256', config.auth.jwtSecret)
    .update(body)
    .digest('base64url');

  const provided = Buffer.from(signature);
  const expected = Buffer.from(expectedSignature);
  if (provided.length !== expected.length || !crypto.timingSafeEqual(provided, expected)) {
    return null;
  }

  try {
    const payload = JSON.parse(base64UrlDecode(encodedPayload));
    if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
};
