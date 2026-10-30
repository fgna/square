import { Module } from '@nestjs/common';
import { DigestTemplateService } from './digest-template.service';
import { DigestTemplateController } from './digest-template.controller';
import { DigestService } from '../email/digest.service';

@Module({
  // DigestService sends the digests; it lives here so admins can send a test.
  providers: [DigestTemplateService, DigestService],
  controllers: [DigestTemplateController],
  exports: [DigestTemplateService],
})
export class DigestTemplateModule {}
