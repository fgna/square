import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { UploadsController } from './uploads.controller';
import { UploadsService } from './uploads.service';
import { S3Service } from './s3.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [
    PrismaModule,
    MulterModule.register({
      storage: undefined,
    }),
  ],
  controllers: [UploadsController],
  providers: [UploadsService, S3Service],
  exports: [S3Service],
})
export class UploadsModule {}
