import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { EventProposalsService } from './event-proposals.service';
import { CreateProposalDto } from './dto/create-proposal.dto';
import { VoteProposalDto } from './dto/vote-proposal.dto';

@Controller('event-proposals')
@UseGuards(JwtAuthGuard)
export class EventProposalsController {
  constructor(private readonly proposals: EventProposalsService) {}

  @Get()
  findAll(
    @CurrentUser() user: { id: string },
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.proposals.findAll(
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 20,
      user.id,
    );
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: { id: string }) {
    return this.proposals.findOne(id, user.id);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  create(@CurrentUser() user: { id: string }, @Body() dto: CreateProposalDto) {
    return this.proposals.create(user.id, dto);
  }

  @Post(':id/vote')
  vote(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
    @Body() dto: VoteProposalDto,
  ) {
    return this.proposals.vote(id, user.id, dto.dateVotes);
  }

  @Delete(':id/vote')
  removeVote(@Param('id') id: string, @CurrentUser() user: { id: string }) {
    return this.proposals.removeVote(id, user.id);
  }

  @Patch(':id/close')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  close(@Param('id') id: string) {
    return this.proposals.close(id);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  delete(@Param('id') id: string) {
    return this.proposals.delete(id);
  }
}
