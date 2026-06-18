import { IsEnum } from 'class-validator';
import { BackupType } from '@wpcc/database';

export class CreateBackupDto {
  @IsEnum(BackupType)
  backupType!: BackupType;
}
