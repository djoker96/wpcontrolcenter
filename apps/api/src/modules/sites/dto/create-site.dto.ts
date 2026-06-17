import { IsEnum, IsNotEmpty, IsString, IsUrl } from 'class-validator';
import { EnvironmentType } from '@wpcc/database';

export class CreateSiteDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsNotEmpty()
  domain!: string;

  @IsUrl({ require_tld: false })
  @IsNotEmpty()
  siteUrl!: string;

  @IsEnum(EnvironmentType)
  environment?: EnvironmentType;
}
