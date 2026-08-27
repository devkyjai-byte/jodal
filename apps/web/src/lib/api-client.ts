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

export interface LoginPayload {
  email: string;
  password: string;
}

/** 로그인 응답은 회원가입과 동일한 형태(accessToken + company)다. */
export type LoginResponse = SignupResponse;

export function login(payload: LoginPayload): Promise<LoginResponse> {
  return request<LoginResponse>('/auth/login', {
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

// --- 공고 피드 (ING-04, CLIENT-01, 02-06) ---

export interface FeedItem {
  id: string;
  title: string;
  agencyName: string | null;
  classificationCode: string | null;
  regionCodes: string[];
  budgetAmount: string | null;
  bidCloseAt: string | null;
  isExpired: boolean;
  /** 5단계 정성 등급만 존재한다 — 원점수 필드는 이 타입에 아예 없다(Legal 제약). */
  qualitativeTier: string;
  matchReason: string;
}

export interface FeedResponse {
  items: FeedItem[];
  hasMore: boolean;
  page: number;
}

export interface FeedQuery {
  keyword?: string;
  classification?: string[];
  region?: string[];
  deadline?: 'this_week' | 'this_month';
  sort?: 'score' | 'deadline' | 'latest';
  includeExpired?: boolean;
  page?: number;
}

export interface FeedFetchResult {
  data: FeedResponse;
  /** apps/web/public/sw.js가 오프라인 폴백으로 캐시 응답을 반환했는지(02-feed.md §엣지 케이스). */
  isFromCache: boolean;
}

function buildFeedQueryString(query: FeedQuery): string {
  const params = new URLSearchParams();
  if (query.keyword) params.set('keyword', query.keyword);
  for (const c of query.classification ?? []) params.append('classification', c);
  for (const r of query.region ?? []) params.append('region', r);
  if (query.deadline) params.set('deadline', query.deadline);
  if (query.sort) params.set('sort', query.sort);
  if (query.includeExpired) params.set('includeExpired', 'true');
  if (query.page) params.set('page', String(query.page));
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

/**
 * getFeed()는 응답 헤더(오프라인 캐시 여부, sw.js가 붙이는 x-jodalmate-cache)를 함께
 * 반환해야 하므로 authorizedRequest()의 body-only 반환 대신 fetch를 직접 다룬다.
 */
export async function getFeed(query: FeedQuery): Promise<FeedFetchResult> {
  const token = getAccessToken();
  const res = await fetch(`${API_BASE_URL}/feed${buildFeedQueryString(query)}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  const data = await handleResponse<FeedResponse>(res);
  return { data, isFromCache: res.headers.get('x-jodalmate-cache') === 'hit' };
}

// --- 공고 상세 (CLIENT-01, 02-06) ---

export interface AnnouncementDetail {
  found: boolean;
  id?: string;
  title?: string;
  sourceBidNo?: string;
  sourceRevisionNo?: string;
  isLatestRevision?: boolean;
  agencyName?: string | null;
  classificationCode?: string | null;
  regionCodes?: string[];
  budgetAmount?: string | null;
  bidOpenAt?: string | null;
  bidCloseAt?: string | null;
  isExpired?: boolean;
  hasParsingGaps?: boolean;
  matchFound?: boolean;
  matchReason?: string;
  matchedPrefix?: string | null;
  regionMatched?: boolean;
  sourceUrl?: string;
  latestRevisionId?: string | null;
}

/**
 * match_id가 주어지면(이메일 알림 진입 경로) 쿼리에 그대로 실어 보낸다 — 소유권 검증은
 * 서버(announcements.service.ts#getDetail)가 담당하며, 불일치 시 ApiError(403)를 던진다.
 */
export function getAnnouncementDetail(
  id: string,
  matchId?: string,
): Promise<AnnouncementDetail> {
  const qs = matchId ? `?match_id=${encodeURIComponent(matchId)}` : '';
  return authorizedRequest<AnnouncementDetail>(`/announcements/${id}${qs}`);
}

// --- "이 공고 저장" 로컬 저장(03-detail.md §상호작용) ---
// db-schema-design.md가 저장 테이블 설계를 Phase 2로 위임했고 03-detail.md도 저장 대상을
// 확정하지 않았으므로, 서버 테이블 없이 로컬스토리지 토글로 이번 Phase 범위를 충족한다.

const SAVED_ANNOUNCEMENTS_STORAGE_KEY = 'jodalmate_saved_announcements';

function readSavedAnnouncementIds(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(SAVED_ANNOUNCEMENTS_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

export function isAnnouncementSaved(id: string): boolean {
  return readSavedAnnouncementIds().includes(id);
}

/** 저장 상태를 토글하고 토글 후의 새 상태(저장됨 여부)를 반환한다. */
export function toggleAnnouncementSaved(id: string): boolean {
  if (typeof window === 'undefined') return false;
  const current = readSavedAnnouncementIds();
  const isSaved = current.includes(id);
  const next = isSaved ? current.filter((x) => x !== id) : [...current, id];
  window.localStorage.setItem(SAVED_ANNOUNCEMENTS_STORAGE_KEY, JSON.stringify(next));
  return !isSaved;
}
