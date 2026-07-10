/**
 * Phase 1 mock auth. The seed inserts 7 demo users (sponsor, CRO PM,
 * PI×2, CRC, CRA, auditor). The login handler accepts a seed email and
 * any password ≥ 4 chars, looks up the user's first role assignment,
 * and returns the minimum session payload the Web shell needs.
 *
 * Phase 2 replaces this with real OIDC + JWT issuance.
 */
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { ApiErrorCode, ApiErrorException } from "@aic-dct/domain";
import { prisma } from "../db.js";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(4),
});

export function registerAuthRoutes(app: FastifyInstance): void {
  app.post("/api/auth/login", async (req) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ApiErrorException(
        ApiErrorCode.VALIDATION_ERROR,
        "账号或密码格式不合法",
        { requestId: req.id, details: { issues: parsed.error.issues } },
      );
    }
    const { email } = parsed.data;
    const user = await prisma().user.findFirst({
      where: { email: { equals: email.toLowerCase() } },
      include: {
        roleAssignments: {
          include: { project: true, site: true },
          orderBy: { assignedAt: "asc" },
        },
      },
    });
    if (!user || user.roleAssignments.length === 0) {
      throw new ApiErrorException(
        ApiErrorCode.UNAUTHORIZED,
        "账号不存在或尚未分配项目角色",
        { requestId: req.id },
      );
    }
    const assignment = user.roleAssignments[0];
    if (!assignment.project) {
      throw new ApiErrorException(
        ApiErrorCode.UNAUTHORIZED,
        "账号尚未绑定到任何研究项目",
        { requestId: req.id },
      );
    }
    return {
      session: {
        userId: user.id,
        email: user.email,
        displayName: user.displayName,
        organization: user.organization ?? undefined,
        role: user.roleAssignments[0].role,
        projectId: assignment.project.id,
        projectCode: assignment.project.code,
        projectName: assignment.project.name,
        loggedInAt: new Date().toISOString(),
      },
    };
  });

  app.post("/api/auth/logout", async () => ({ ok: true }));
  app.get("/api/auth/session", async () => ({ session: null }));
}
