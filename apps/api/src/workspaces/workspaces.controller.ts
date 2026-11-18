import { Controller, Get, Post, Body, Param, Put, Delete } from '@nestjs/common';
import { WorkspacesService } from './workspaces.service';
import { CreateWorkspaceDTO, UpdateWorkspaceDTO } from '@fake-trello/shared';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('workspaces')
export class WorkspacesController {
  constructor(private workspacesService: WorkspacesService) {}

  @Get()
  async findAll(@CurrentUser() user: any) {
    return this.workspacesService.findAll(user.id);
  }

  @Get(':id')
  async findById(@Param('id') id: string, @CurrentUser() user: any) {
    return this.workspacesService.findById(id, user.id);
  }

  @Post()
  async create(@CurrentUser() user: any, @Body() createWorkspaceDto: CreateWorkspaceDTO) {
    return this.workspacesService.create(user.id, createWorkspaceDto);
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Body() updateWorkspaceDto: UpdateWorkspaceDTO,
  ) {
    return this.workspacesService.update(id, user.id, updateWorkspaceDto);
  }

  @Delete(':id')
  async delete(@Param('id') id: string, @CurrentUser() user: any) {
    return this.workspacesService.delete(id, user.id);
  }

  @Post(':id/members')
  async addMember(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Body() body: { userId: string; role: string },
  ) {
    return this.workspacesService.addMember(id, user.id, body.userId, body.role);
  }

  @Delete(':workspaceId/members/:userId')
  async removeMember(
    @Param('workspaceId') workspaceId: string,
    @CurrentUser() user: any,
    @Param('userId') userId: string,
  ) {
    return this.workspacesService.removeMember(workspaceId, user.id, userId);
  }
}
