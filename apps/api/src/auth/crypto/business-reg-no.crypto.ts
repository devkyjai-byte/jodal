/**
 * 사업자등록번호 암호화·다이제스트·형식 검증.
 *
 * db-schema-design.md §민감정보 저장 규칙:
 * - 평문 컬럼을 두지 않는다 — 암호문(business_reg_no_encrypted) + 다이제스트(business_reg_no_digest)만 저장.
 * - 암호화: 애플리케이션 레벨 AES-256-GCM (02-01 checkpoint:decision 확정값). pgcrypto 미사용.
 * - 다이제스트: 단순 SHA-256 절대 금지 — 서버 pepper를 섞은 HMAC-SHA256만 사용
 *   (다이제스트 컬럼 유출 시 10자리 숫자 전수 역산 공격을 막기 위함).
 *
 * bcrypt 등 신규 패키지 설치 없음 — Node.js 내장 crypto 모듈만 사용 (02-02-PLAN.md 지시).
 */
import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
} from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // GCM 표준 nonce 길이(96비트)
const AUTH_TAG_LENGTH = 16;

/**
 * 사업자등록번호 체크섬 검증 (10자리 숫자, 마지막 자리가 체크디지트).
 * 국세청 공개 검증 알고리즘: weights=[1,3,7,1,3,7,1,3,5], 9번째 자리(인덱스 8)는
 * *5 후 몫(//10)을 합산에 더한다. 체크섬 통과는 형식 유효성만 보장하며 실재 여부는
 * 보장하지 않는다(RESEARCH.md §Don't Hand-Roll — 진위확인 API는 별도 과제, PROF-05 후속).
 */
export function isValidBusinessRegNoFormat(bizNo: string): boolean {
  if (!/^\d{10}$/.test(bizNo)) {
    return false;
  }
  const digits = bizNo.split('').map(Number);
  const weights = [1, 3, 7, 1, 3, 7, 1, 3, 5];
  let sum = 0;
  for (let i = 0; i < 9; i += 1) {
    sum += digits[i] * weights[i];
  }
  sum += Math.floor((digits[8] * 5) / 10);
  const checkDigit = (10 - (sum % 10)) % 10;
  return checkDigit === digits[9];
}

function getEncryptionKey(): Buffer {
  const raw = process.env.BUSINESS_REG_NO_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      'BUSINESS_REG_NO_ENCRYPTION_KEY 환경변수가 설정되지 않았습니다. env.example 참고.',
    );
  }
  const key = Buffer.from(raw, 'base64');
  if (key.length !== 32) {
    throw new Error(
      'BUSINESS_REG_NO_ENCRYPTION_KEY는 base64로 인코딩된 32바이트 키여야 합니다 ' +
        "(node -e \"console.log(require('crypto').randomBytes(32).toString('base64'))\").",
    );
  }
  return key;
}

function getPepper(): string {
  const pepper = process.env.BUSINESS_REG_NO_HMAC_PEPPER;
  if (!pepper) {
    throw new Error(
      'BUSINESS_REG_NO_HMAC_PEPPER 환경변수가 설정되지 않았습니다. env.example 참고.',
    );
  }
  return pepper;
}

/**
 * AES-256-GCM으로 사업자등록번호를 암호화한다.
 * 저장 형식: iv(12B) || authTag(16B) || ciphertext — 단일 BYTEA 컬럼(business_reg_no_encrypted)에
 * 그대로 저장한다. GCM의 인증 태그가 무결성(변조 탐지)까지 보장한다.
 */
export function encryptBusinessRegNo(bizNo: string): Buffer {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(bizNo, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, ciphertext]);
}

/** encryptBusinessRegNo로 저장된 BYTEA를 복호화한다. 02-03(마스킹 재노출)이 사용한다. */
export function decryptBusinessRegNo(encrypted: Buffer): string {
  const key = getEncryptionKey();
  const iv = encrypted.subarray(0, IV_LENGTH);
  const authTag = encrypted.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = encrypted.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString('utf8');
}

/**
 * HMAC-SHA256(bizNo, pepper) — 중복 가입 판정·조회용 다이제스트.
 * companies.business_reg_no_digest에 UNIQUE 제약이 걸려 있어(db-schema-design.md),
 * 이 값이 충돌하면 Prisma가 P2002를 던진다 — AuthService가 이를 409로 변환한다.
 */
export function digestBusinessRegNo(bizNo: string): Buffer {
  const pepper = getPepper();
  return createHmac('sha256', pepper).update(bizNo, 'utf8').digest();
}
