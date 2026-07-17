import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { getUserByPhone, verifyPassword } from '../lib/auth.js';
import { logAudit } from '../lib/audit.js';
import { prisma } from '../db.js';

const loginSchema = z.object({
  phone: z.string().min(1),
  password: z.string().min(1),
  organizationId: z.string().optional(),
});

export async function authRoutes(app: FastifyInstance) {
  app.get('/organizations', async () => {
    const orgs = await prisma.organization.findMany({
      select: { id: true, name: true, code: true },
    });
    return { organizations: orgs };
  });

  app.post('/login', async (request, reply) => {
    const body = loginSchema.safeParse(request.body);
    if (!body.success) {
      return reply.status(400).send({
        error: { code: 'VALIDATION_ERROR', message: '参数无效', details: body.error.flatten() },
      });
    }

    const user = await getUserByPhone(body.data.phone);
    if (!user) {
      return reply.status(401).send({
        error: { code: 'INVALID_CREDENTIALS', message: '手机号或密码错误' },
      });
    }

    if (body.data.organizationId && user.organizationId !== body.data.organizationId) {
      return reply.status(401).send({
        error: { code: 'ORG_MISMATCH', message: '组织不匹配' },
      });
    }

    const valid = await verifyPassword(body.data.password, user.passwordHash);
    if (!valid) {
      return reply.status(401).send({
        error: { code: 'INVALID_CREDENTIALS', message: '手机号或密码错误' },
      });
    }

    const token = app.jwt.sign(
      { sub: user.id, role: user.role, orgId: user.organizationId },
      { expiresIn: '7d' },
    );

    await logAudit({
      type: 'LOGIN',
      userId: user.id,
      entityType: 'User',
      entityId: user.id,
    });

    return {
      token,
      user: {
        id: user.id,
        phone: user.phone,
        name: user.name,
        role: user.role,
        organization: {
          id: user.organization.id,
          name: user.organization.name,
          code: user.organization.code,
        },
      },
    };
  });

  app.get('/me', { preHandler: [app.authenticate] }, async (request) => {
    const user = request.user;
    const full = await prisma.user.findUnique({
      where: { id: user.id },
      include: { organization: true },
    });
    return {
      user: {
        id: full!.id,
        phone: full!.phone,
        name: full!.name,
        role: full!.role,
        organization: full!.organization,
      },
    };
  });
}