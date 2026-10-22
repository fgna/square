import { Controller, Get, Post, Patch, Delete, Body, Param, Header, StreamableFile } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { DigestTemplateService } from './digest-template.service';
import { CreateDigestTemplateDto } from './dto/create-digest-template.dto';
import { UpdateDigestTemplateDto } from './dto/update-digest-template.dto';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('digest-templates')
@ApiBearerAuth()
@Controller('digest-templates')
export class DigestTemplateController {
  constructor(private digestTemplateService: DigestTemplateService) {}

  @Get()
  @Roles('ADMIN')
  @ApiOperation({ summary: 'List all digest templates (Admin only)' })
  findAll() {
    return this.digestTemplateService.findAll();
  }

  @Post()
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Create a digest template (Admin only)' })
  create(@Body() dto: CreateDigestTemplateDto) {
    return this.digestTemplateService.create(dto);
  }

  @Get('preview/:id')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Preview rendered digest template HTML (Admin only)' })
  @Header('Content-Type', 'text/html')
  async preview(@Param('id') id: string): Promise<StreamableFile> {
    const html = await this.digestTemplateService.renderPreview(id);
    return new StreamableFile(Buffer.from(html, 'utf-8'));
  }

  @Get(':id')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Get a digest template by ID (Admin only)' })
  findOne(@Param('id') id: string) {
    return this.digestTemplateService.findOne(id);
  }

  @Patch(':id')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Update a digest template (Admin only)' })
  update(@Param('id') id: string, @Body() dto: UpdateDigestTemplateDto) {
    return this.digestTemplateService.update(id, dto);
  }

  @Delete(':id')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Delete a digest template (Admin only)' })
  remove(@Param('id') id: string) {
    return this.digestTemplateService.delete(id);
  }

  @Post(':id/activate')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Set a digest template as the active one (Admin only)' })
  activate(@Param('id') id: string) {
    return this.digestTemplateService.setActive(id);
  }
}
