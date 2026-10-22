import {
  Controller,
  Post,
  Delete,
  Param,
  UseGuards,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UploadsService } from './uploads.service';

@Controller('uploads')
@UseGuards(JwtAuthGuard)
export class UploadsController {
  constructor(private readonly uploads: UploadsService) {}

  @Post('image')
  @UseInterceptors(FileInterceptor('file', { storage: undefined, limits: { fileSize: 10 * 1024 * 1024 } }))
  uploadImage(
    @CurrentUser() user: { id: string },
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.uploads.uploadImage(user.id, file);
  }

  @Post('file')
  @UseInterceptors(FileInterceptor('file', { storage: undefined, limits: { fileSize: 50 * 1024 * 1024 } }))
  uploadFile(
    @CurrentUser() user: { id: string },
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.uploads.uploadFile(user.id, file);
  }

  @Delete(':key(*)')
  deleteUpload(
    @Param('key') key: string,
    @CurrentUser() user: { id: string; role: string },
  ) {
    return this.uploads.deleteUpload(key, user.id, user.role);
  }
}
