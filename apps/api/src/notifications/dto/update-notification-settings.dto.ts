import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  Matches,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';

const TIME_HHMM_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * PATCH /notification-settings — 04-notification-settings.md §데이터 소스 표의 8개 항목을
 * 전부 선택적 필드로 받는다(토글 하나 바뀔 때마다 즉시 저장되는 UX를 지원하기 위해
 * 항목별 부분 갱신을 허용 — 02-07-PLAN.md action).
 *
 * quietHoursStart/quietHoursEnd: "HH:MM" 문자열 또는 `null`(미설정으로 되돌림)을 받는다.
 * `null`일 때는 @ValidateIf 조건이 꺼져 형식 검증을 건너뛴다.
 */
export class UpdateNotificationSettingsDto {
  @IsOptional()
  @IsBoolean()
  emailEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  pushEnabled?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  minScoreThreshold?: number;

  @IsOptional()
  @IsIn(['immediate', 'daily_digest'])
  digestFrequency?: 'immediate' | 'daily_digest';

  @IsOptional()
  @ValidateIf((o: UpdateNotificationSettingsDto) => o.quietHoursStart !== null)
  @Matches(TIME_HHMM_PATTERN, {
    message: 'quietHoursStart는 HH:MM 형식이거나 null이어야 합니다.',
  })
  quietHoursStart?: string | null;

  @IsOptional()
  @ValidateIf((o: UpdateNotificationSettingsDto) => o.quietHoursEnd !== null)
  @Matches(TIME_HHMM_PATTERN, {
    message: 'quietHoursEnd는 HH:MM 형식이거나 null이어야 합니다.',
  })
  quietHoursEnd?: string | null;

  @IsOptional()
  @IsBoolean()
  deadlineReminderEnabled?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(30)
  deadlineReminderDays?: number;
}
