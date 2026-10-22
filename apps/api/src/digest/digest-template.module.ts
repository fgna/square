import { Module } from '@nestjs/common';
import { DigestTemplateService } from './digest-template.service';
import { DigestTemplateController } from './digest-template.controller';

@Module({
  providers: [DigestTemplateService],
  controllers: [DigestTemplateController],
  exports: [DigestTemplateService],
})
export class DigestTemplateModule {}
