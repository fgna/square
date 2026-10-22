import { PartialType } from '@nestjs/swagger';
import { CreateDigestTemplateDto } from './create-digest-template.dto';

export class UpdateDigestTemplateDto extends PartialType(CreateDigestTemplateDto) {}
