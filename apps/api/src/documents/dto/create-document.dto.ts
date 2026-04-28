import { IsDateString, IsEnum, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { DocumentCategory } from '../../common/types/roles';

export class CreateDocumentDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  title: string;

  @IsEnum(DocumentCategory)
  category: DocumentCategory;

  @IsUUID()
  ownerMemberId: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}
