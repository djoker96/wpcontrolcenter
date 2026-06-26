import { IsEnum, IsNotEmpty, IsBoolean, IsOptional, Validate } from 'class-validator';
import { NotificationChannelType } from '@wpcc/database';
import { IsValidDestination } from './is-valid-destination.decorator';

export class CreateChannelDto {
  @IsEnum(NotificationChannelType)
  channelType: NotificationChannelType;

  @IsValidDestination()
  @IsNotEmpty()
  destination: string;

  @IsBoolean()
  @IsOptional()
  isEnabled?: boolean;
}
