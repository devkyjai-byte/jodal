/**
 * NestJS API 호출용 fetch 래퍼. NEXT_PUBLIC_API_URL 환경변수(기본값: http://localhost:3001)를
 * 기준으로 요청을 보낸다. 02-01의 apps/api/src/main.ts 기본 포트(3001)와 짝을 이룬다.
 */
const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, options: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  const contentType = res.headers.get('content-type') ?? '';
  const body = contentType.includes('application/json')
    ? ((await res.json()) as unknown)
    : await res.text();

  if (!res.ok) {
    const message =
      typeof body === 'object' &&
      body !== null &&
      'message' in body &&
      typeof (body as { message?: unknown }).message === 'string'
        ? (body as { message: string }).message
        : `API request failed with status ${res.status}`;
    throw new ApiError(message, res.status, body);
  }

  return body as T;
}

export interface SignupPayload {
  businessRegNo: string;
  companyName: string;
  contactEmail: string;
  password: string;
  privacyConsent: boolean;
}

export interface SignupResponse {
  accessToken: string;
  company: {
    id: string;
    companyName: string;
    contactEmail: string;
  };
}

export function signup(payload: SignupPayload): Promise<SignupResponse> {
  return request<SignupResponse>('/auth/signup', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/** 회원가입/로그인 성공 후 JWT를 로컬에 저장한다. 02-03이 로그인 흐름에서도 재사용한다. */
const ACCESS_TOKEN_STORAGE_KEY = 'jodalmate_access_token';

export function storeAccessToken(token: string): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, token);
}

export function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY);
}
