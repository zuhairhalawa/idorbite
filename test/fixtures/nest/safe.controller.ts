// Control fixture: every handler on "note" guards. Should produce NO findings.
import { Controller, Get, Patch, Delete, Param } from '@nestjs/common';

@Controller('notes')
export class NoteController {
  constructor(private prisma: any) {}

  @Get('/:id')
  async getNote(@Param('id') id: string, userId: string) {
    return this.prisma.note.findFirst({ where: { id, userId } });
  }

  @Patch('/:id')
  async updateNote(@Param('id') id: string, userId: string) {
    await assertNoteOwner(id, userId);
    return this.prisma.note.update({ where: { id, userId }, data: {} });
  }

  @Delete('/:id')
  async deleteNote(@Param('id') id: string, userId: string) {
    await assertNoteOwner(id, userId);
    return this.prisma.note.delete({ where: { id, userId } });
  }
}

declare function assertNoteOwner(id: string, userId: string): Promise<void>;
