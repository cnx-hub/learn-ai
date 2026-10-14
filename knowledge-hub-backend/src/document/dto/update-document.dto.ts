import { CreateDocumentDto } from './create-document.dto';
import { PartialType, OmitType } from '@nestjs/mapped-types';
import { IsOptional, IsString } from 'class-validator';

export class UpdateDocumentDto extends PartialType(
  OmitType(CreateDocumentDto, ['createBy'] as const),
) {
  /** 更新人 ID */
  @IsOptional()
  @IsString()
  updateBy?: string;
}
