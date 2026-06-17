import { IsEnum, IsNotEmpty, IsString, IsBoolean, IsOptional } from 'class-validator';
import { NotificationChannelType } from '@wpcc/database';

export class CreateChannelDto {
  @IsEnum(NotificationChannelType)
  channelType: NotificationChannelType;

  @IsString()
  @IsNotEmpty()
  destination: string;

  @IsBoolean()
  @IsOptional()
  isEnabled?: boolean;
}
