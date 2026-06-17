import { IsEnum, IsString, IsBoolean, IsOptional } from 'class-validator';
import { NotificationChannelType } from '@wpcc/database';

export class UpdateChannelDto {
  @IsEnum(NotificationChannelType)
  @IsOptional()
  channelType?: NotificationChannelType;

  @IsString()
  @IsOptional()
  destination?: string;

  @IsBoolean()
  @IsOptional()
  isEnabled?: boolean;
}
