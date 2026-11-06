import prisma from '@/lib/prisma';

export const GET = withTeamApi(async (req: any, { params }: any) => {
  const { id: dataroomId } = params;
  return prisma.dataroomDocument.count({ where: { dataroomId, teamId: req.teamId } });
});

declare function withTeamApi(fn: any): any;
