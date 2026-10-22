import { Controller, Get, Post, Put, Delete, Body, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { GoalsService } from './goals.service';
import { CreateGoalDto } from './dto/create-goal.dto';
import { UpdateGoalDto } from './dto/update-goal.dto';
import { ReorderGoalsDto } from './dto/reorder-goals.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('goals')
@ApiBearerAuth()
@Controller('goals')
export class GoalsController {
  constructor(private goalsService: GoalsService) {}

  @Get()
  @ApiOperation({ summary: 'List current user goals' })
  findAll(@CurrentUser() user: any) {
    return this.goalsService.findAll(user.id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a goal (max 5)' })
  create(@Body() dto: CreateGoalDto, @CurrentUser() user: any) {
    return this.goalsService.create(user.id, dto);
  }

  @Put('reorder')
  @ApiOperation({ summary: 'Reorder goals' })
  reorder(@Body() dto: ReorderGoalsDto, @CurrentUser() user: any) {
    return this.goalsService.reorder(user.id, dto.ids);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a goal' })
  update(@Param('id') id: string, @Body() dto: UpdateGoalDto, @CurrentUser() user: any) {
    return this.goalsService.update(id, user.id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a goal' })
  remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.goalsService.delete(id, user.id);
  }
}
