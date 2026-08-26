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
  return handleResponse<T>(res);
}

/**
 * JWT를 Authorization 헤더에 실어 보내는 요청. `getAccessToken()`이 담당하는 저장소
 * 접근과 분리해, 온보딩 스텝(업종·지역·실적·인증)의 모든 요청이 이 헬퍼를 재사용한다.
 */
async function authorizedRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = getAccessToken();
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  return handleResponse<T>(res);
}

async function handleResponse<T>(res: Response): Promise<T> {
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

// --- 온보딩 스텝 2 — 업종(분류코드) 다중 등록/조회/삭제 ---

export interface ClassificationCodeItem {
  id: string;
  classificationCode: string;
}

export function listClassificationCodes(): Promise<ClassificationCodeItem[]> {
  return authorizedRequest<ClassificationCodeItem[]>(
    '/companies/me/classification-codes',
  );
}

export function addClassificationCode(
  code: string,
): Promise<ClassificationCodeItem> {
  return authorizedRequest<ClassificationCodeItem>(
    '/companies/me/classification-codes',
    { method: 'POST', body: JSON.stringify({ code }) },
  );
}

export function deleteClassificationCode(id: string): Promise<void> {
  return authorizedRequest<void>(
    `/companies/me/classification-codes/${id}`,
    { method: 'DELETE' },
  );
}

// --- 프로필 조회/지역 갱신 (온보딩 스텝 3 + 다운스트림 재사용) ---

export interface CompanyProfile {
  id: string;
  companyName: string;
  contactEmail: string;
  regionCodes: string[];
  verificationStatus: string;
  classificationCodes: ClassificationCodeItem[];
  profileComplete: boolean;
}

export function getCompanyProfile(): Promise<CompanyProfile> {
  return authorizedRequest<CompanyProfile>('/companies/me');
}

export function updateRegionCodes(
  regionCodes: string[],
): Promise<{ regionCodes: string[] }> {
  return authorizedRequest<{ regionCodes: string[] }>('/companies/me', {
    method: 'PATCH',
    body: JSON.stringify({ regionCodes }),
  });
}

// --- 온보딩 스텝 4 — 실적(선택) ---

export interface PerformanceItem {
  id: string;
  projectName: string;
  contractAmount: string | null;
  contractDate: string | null;
  agencyName: string | null;
}

export interface AddPerformancePayload {
  projectName: string;
  contractAmount?: string;
  contractDate?: string;
  agencyName?: string;
}

export function listPerformances(): Promise<PerformanceItem[]> {
  return authorizedRequest<PerformanceItem[]>('/companies/me/performances');
}

export function addPerformance(
  payload: AddPerformancePayload,
): Promise<PerformanceItem> {
  return authorizedRequest<PerformanceItem>('/companies/me/performances', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function deletePerformance(id: string): Promise<void> {
  return authorizedRequest<void>(`/companies/me/performances/${id}`, {
    method: 'DELETE',
  });
}

// --- 온보딩 스텝 4 — 인증(선택) ---

export interface CertificationItem {
  id: string;
  certType: string;
  certNumber: string | null;
  expiresAt: string | null;
}

export interface AddCertificationPayload {
  certType: string;
  certNumber?: string;
  expiresAt?: string;
}

export function listCertifications(): Promise<CertificationItem[]> {
  return authorizedRequest<CertificationItem[]>('/companies/me/certifications');
}

export function addCertification(
  payload: AddCertificationPayload,
): Promise<CertificationItem> {
  return authorizedRequest<CertificationItem>('/companies/me/certifications', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function deleteCertification(id: string): Promise<void> {
  return authorizedRequest<void>(`/companies/me/certifications/${id}`, {
    method: 'DELETE',
  });
}
