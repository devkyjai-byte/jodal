import { Type } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';

/**
 * GET /notification-settings/preview?threshold=N — 슬라이더 조정 중 "이 값으로 설정하면
 * 최근 7일 기준 약 N건" 안내용(04-notification-settings.md §상호작용).
 */
export class NotificationSettingsPreviewQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  threshold!: number;
}
