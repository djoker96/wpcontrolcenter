import { IsEnum, IsOptional, IsString, IsUrl } from 'class-validator';
import { EnvironmentType, SiteStatus } from '@wpcc/database';

export class UpdateSiteDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  domain?: string;

  @IsUrl({ require_tld: false })
  @IsOptional()
  siteUrl?: string;

  @IsEnum(EnvironmentType)
  @IsOptional()
  environment?: EnvironmentType;

  @IsEnum(SiteStatus)
  @IsOptional()
  status?: SiteStatus;
}
