import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class AttachIntegrationDto {
  @IsString()
  @IsNotEmpty()
  integrationAccountId: string;

  @IsString()
  @IsOptional()
  externalPropertyId?: string;
}
