import { ArrayMaxSize, IsArray, IsString, MaxLength } from 'class-validator';

/**
 * PATCH /companies/me { regionCodes } — db-schema-design.md §복수성·병합 규칙 (a)의
 * `companies.region_codes VARCHAR(10)[]`와 동일한 제약(각 원소 10자 이내)을 API 레벨에서도
 * 검증한다(ASVS V5). 시/도 값 자체(예: "서울특별시")는 온보딩 UI가 고정 목록에서 고르므로
 * 여기서는 형식만 검증하고 화이트리스트 검증은 하지 않는다.
 */
export class UpdateRegionCodesDto {
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(10, { each: true })
  regionCodes!: string[];
}
