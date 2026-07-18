import { compare, hash } from "bcryptjs";

const BCRYPT_ROUNDS = 10;
const MIN_PASSWORD_LENGTH = 8;

export function isPasswordStrong(password: string): boolean {
  return password.trim().length >= MIN_PASSWORD_LENGTH;
}

export function isPlaceholderPasswordHash(passwordHash: string): boolean {
  return passwordHash.startsWith("auth-oauth:");
}

export async function hashPassword(password: string): Promise<string> {
  return hash(password.trim(), BCRYPT_ROUNDS);
}

export async function verifyPassword(
  password: string,
  passwordHash: string,
): Promise<boolean> {
  if (!passwordHash || isPlaceholderPasswordHash(passwordHash)) {
    return false;
  }
  try {
    return await compare(password.trim(), passwordHash);
  } catch {
    return false;
  }
}
