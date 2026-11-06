// Fixture modeled on the real Papermark bug: the GET handler is wrapped by withTeamApi (auth) but
// forgets to scope by teamId, while the POST sibling does. withTeamApi is NOT an object-level guard.
import prisma from '@/lib/prisma';

export const GET = withTeamApi(async (req: any, { params }: any) => {
  const { id: dataroomId } = params;
  // BUG: filtered only by dataroomId — no teamId scope
  return prisma.dataroomDocument.findMany({ where: { dataroomId, folderId: null } });
});

export const POST = withTeamApi(async (req: any, { params }: any) => {
  const { id: dataroomId } = params;
  const dr = await prisma.dataroom.findUnique({ where: { id: dataroomId, teamId: req.teamId } });
  return prisma.dataroomDocument.create({ data: { dataroomId: dr.id } });
});

declare function withTeamApi(fn: any): any;
