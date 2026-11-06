// Fixture modeled on the Papermark / Teable sibling-gap shape.
// getDocuments is the vulnerable one: siblings scope by team / call verifyFolderAccess, it doesn't.
import { Controller, Get, Post, Patch, Param, Body } from '@nestjs/common';

@Controller('datarooms')
export class DataroomController {
  constructor(private prisma: any) {}

  @Get('/:id/documents')
  async getDocuments(@Param('id') dataroomId: string) {
    // BUG: no team/owner scoping, no verify call
    return this.prisma.dataroomDocument.findMany({
      where: { dataroomId, folderId: null },
    });
  }

  @Get('/:id/stats')
  async getStats(@Param('id') dataroomId: string, userId: string) {
    await verifyFolderAccess({ userId, dataroomId });
    return this.prisma.dataroomDocument.count({ where: { dataroomId } });
  }

  @Post('/:id/documents')
  @Permissions('datarooms|create')
  async addDocument(@Param('id') dataroomId: string, @Body() body: any) {
    const dr = await this.prisma.dataroom.findUnique({ where: { id: dataroomId, teamId: body.teamId } });
    return this.prisma.dataroomDocument.create({ data: { dataroomId: dr.id, ...body } });
  }

  @Patch('/:id/branding')
  async updateBranding(@Param('id') dataroomId: string, userId: string, @Body() body: any) {
    await verifyFolderAccess({ userId, dataroomId });
    return this.prisma.dataroom.update({ where: { id: dataroomId, teamId: body.teamId }, data: body });
  }
}

declare function verifyFolderAccess(x: any): Promise<void>;
declare function Permissions(x: string): MethodDecorator;
