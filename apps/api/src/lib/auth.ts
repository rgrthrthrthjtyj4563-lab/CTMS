import type { FastifyRequest, FastifyReply } from 'fastify';
import bcrypt from 'bcryptjs';
import { prisma } from '../db.js';

export interface AuthUser {
  id: string;
  phone: string;
  name: string;
  role: string;
  organizationId: string;
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: { sub: string; role: string; orgId: string };
    user: AuthUser;
  }
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export async function getUserByPhone(phone: string) {
  return prisma.user.findUnique({
    where: { phone },
    include: { organization: true },
  });
}

export async function getUserById(id: string): Promise<AuthUser | null> {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) return null;
  return {
    id: user.id,
    phone: user.phone,
    name: user.name,
    role: user.role,
    organizationId: user.organizationId,
  };
}

export async function authenticate(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  try {
    const payload = await request.jwtVerify<{ sub: string; role: string; orgId: string }>();
    const user = await getUserById(payload.sub);
    if (!user) {
      return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: '用户不存在' } });
    }
    request.user = user;
  } catch {
    return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: '未授权' } });
  }
}

export function requireRoles(...roles: string[]) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    await authenticate(request, reply);
    if (reply.sent) return;
    const user = request.user as AuthUser;
    if (!roles.includes(user.role)) {
      return reply.status(403).send({ error: { code: 'FORBIDDEN', message: '权限不足' } });
    }
  };
}

export async function userHasProjectAccess(
  userId: string,
  projectId: string,
  siteId?: string,
): Promise<boolean> {
  const assignment = await prisma.userAssignment.findFirst({
    where: {
      userId,
      projectId,
      ...(siteId ? { OR: [{ siteId }, { siteId: null }] } : {}),
    },
  });
  return !!assignment;
}