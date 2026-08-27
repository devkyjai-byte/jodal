import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

/**
 * GET /feed 쿼리 파라미터 — ING-04(키워드·업종·지역·마감일 검색·필터링) + 정렬/페이지네이션.
 * 02-feed.md §레이아웃 1~2, §상호작용 전체와 짝을 이룬다.
 */
export class SearchQueryDto {
  @IsOptional()
  @IsString()
  keyword?: string;

  /** 업체가 등록한(또는 임시 선택한) 물품분류 prefix 다중 선택. */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Transform(({ value }: { value: unknown }) =>
    value === undefined ? undefined : Array.isArray(value) ? value : [value],
  )
  classification?: string[];

  /** 시/도 다중 선택 — companies.region_codes와 동일한 표기(예: "서울특별시")를 그대로 쓴다. */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Transform(({ value }: { value: unknown }) =>
    value === undefined ? undefined : Array.isArray(value) ? value : [value],
  )
  region?: string[];

  @IsOptional()
  @IsIn(['this_week', 'this_month'])
  deadline?: 'this_week' | 'this_month';

  @IsOptional()
  @IsIn(['score', 'deadline', 'latest'])
  sort?: 'score' | 'deadline' | 'latest';

  /** 마감이 지난 공고 포함 여부 — 기본값 false(02-feed.md §엣지 케이스 "마감이 지난 공고"). */
  @IsOptional()
  @Transform(
    ({ value }: { value: unknown }) => value === 'true' || value === true,
  )
  @IsBoolean()
  includeExpired?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;
}
