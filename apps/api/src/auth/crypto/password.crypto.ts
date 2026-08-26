/**
 * 비밀번호 해시 — Node.js 내장 crypto.scrypt 사용. bcrypt 등 신규 패키지 설치 없음
 * (02-02-PLAN.md 지시). ASVS V2 Authentication 충족.
 *
 * 저장 형식: `scrypt$N$r$p$saltHex$hashHex` 단일 문자열 — companies.password_hash(TEXT)에 저장.
 */
import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt) as (
  password: string,
  salt: Buffer,
  keylen: number,
  options: { N: number; r: number; p: number },
) => Promise<Buffer>;

// N=16384(2^14)는 scrypt 논문·OWASP 권장 최소치. r=8, p=1은 표준 관례값.
// 메모리 비용 ≈ 128 * N * r = 16MB — Node 기본 scrypt maxmem(32MB) 이내.
const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_LENGTH = 64;
const SALT_LENGTH = 16;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH);
  const derivedKey = await scryptAsync(password, salt, KEY_LENGTH, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
  });
  return [
    'scrypt',
    SCRYPT_N,
    SCRYPT_R,
    SCRYPT_P,
    salt.toString('hex'),
    derivedKey.toString('hex'),
  ].join('$');
}

/** 02-03(로그인)이 사용할 검증 함수 — 이 플랜에서는 회원가입 해시 생성만 쓰인다. */
export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') {
    return false;
  }
  const [, nStr, rStr, pStr, saltHex, hashHex] = parts;
  const N = Number(nStr);
  const r = Number(rStr);
  const p = Number(pStr);
  if (!Number.isFinite(N) || !Number.isFinite(r) || !Number.isFinite(p)) {
    return false;
  }

  const salt = Buffer.from(saltHex, 'hex');
  const expected = Buffer.from(hashHex, 'hex');
  const derivedKey = await scryptAsync(password, salt, expected.length, {
    N,
    r,
    p,
  });

  return (
    derivedKey.length === expected.length &&
    timingSafeEqual(derivedKey, expected)
  );
}
