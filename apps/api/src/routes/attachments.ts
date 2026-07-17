import type { FastifyInstance } from 'fastify';
import { createWriteStream } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { randomUUID } from 'node:crypto';
import type { AuthUser } from '../lib/auth.js';
import { prisma } from '../db.js';
import { logAudit } from '../lib/audit.js';
import { analyzeImageAttachment } from '../lib/vision.js';

export async function attachmentRoutes(app: FastifyInstance) {
  const uploadDir = process.env.UPLOAD_DIR || './uploads';

  app.post('/upload', { preHandler: [app.authenticate] }, async (request, reply) => {
    const user = request.user as AuthUser;
    const data = await request.file();

    if (!data) {
      return reply.status(400).send({ error: { code: 'NO_FILE', message: '未上传文件' } });
    }

    const monitoringVisitId = (data.fields.monitoringVisitId as { value?: string })?.value;
    const clientAttachmentId = (data.fields.clientAttachmentId as { value?: string })?.value;
    const purpose =
      (data.fields.purpose as { value?: string })?.value ||
      (data.fields.fileType as { value?: string })?.value;
    const note = (data.fields.note as { value?: string })?.value;

    await mkdir(uploadDir, { recursive: true });

    // Idempotent re-upload by client id
    if (clientAttachmentId) {
      const existing = await prisma.attachment.findFirst({
        where: { clientAttachmentId, userId: user.id },
      });
      if (existing) {
        return {
          attachment: {
            id: existing.id,
            fileName: existing.fileName,
            mimeType: existing.mimeType,
            fileSize: existing.fileSize,
            fileType: existing.fileType,
            sensitiveFlag: existing.sensitiveFlag,
            sensitiveHints: [] as string[],
            monitoringVisitId: existing.monitoringVisitId,
            url: `/uploads/${existing.filePath}`,
            purpose: existing.fileType,
            note: null,
          },
          idempotent: true,
        };
      }
    }

    const ext = path.extname(data.filename) || '';
    const storedName = `${randomUUID()}${ext}`;
    const filePath = path.join(uploadDir, storedName);

    await pipeline(data.file, createWriteStream(filePath));

    const stats = await import('node:fs/promises').then((fs) => fs.stat(filePath));

    let visionHints: string[] = [];
    let sensitiveFlag: boolean;
    let fileType: string | null;

    if (data.mimetype.startsWith('image/')) {
      const vision = await analyzeImageAttachment(filePath, data.mimetype, data.filename);
      sensitiveFlag = vision.sensitiveFlag;
      visionHints = vision.hints;
      fileType = purpose || vision.suggestedFileType || null;
    } else {
      const fileNameLower = data.filename.toLowerCase();
      sensitiveFlag = ['身份证', '手机号', '姓名'].some((k) => fileNameLower.includes(k));
      fileType = purpose || null;
    }

    const attachment = await prisma.attachment.create({
      data: {
        monitoringVisitId: monitoringVisitId || null,
        userId: user.id,
        fileName: data.filename,
        mimeType: data.mimetype,
        filePath: storedName,
        fileSize: stats.size,
        fileType,
        clientAttachmentId,
        syncStatus: 'SYNCED',
        sensitiveFlag,
      },
    });

    await logAudit({
      type: 'ATTACHMENT_UPLOADED',
      userId: user.id,
      entityType: 'Attachment',
      entityId: attachment.id,
      payload: {
        fileName: data.filename,
        visitId: monitoringVisitId,
        visionHints,
        purpose: fileType,
        note: note ?? null,
      },
    });

    return {
      attachment: {
        id: attachment.id,
        fileName: attachment.fileName,
        mimeType: attachment.mimeType,
        fileSize: attachment.fileSize,
        fileType: attachment.fileType,
        purpose: attachment.fileType,
        note: note ?? null,
        sensitiveFlag: attachment.sensitiveFlag,
        sensitiveHints: visionHints,
        monitoringVisitId: attachment.monitoringVisitId,
        url: `/uploads/${storedName}`,
      },
      idempotent: false,
    };
  });

  app.patch('/:id', { preHandler: [app.authenticate] }, async (request, reply) => {
    const user = request.user as AuthUser;
    const { id } = request.params as { id: string };
    const body = request.body as { purpose?: string; fileType?: string; confirmed?: boolean; note?: string };

    const attachment = await prisma.attachment.findUnique({ where: { id } });
    if (!attachment) {
      return reply.status(404).send({ error: { code: 'NOT_FOUND', message: '附件不存在' } });
    }

    const purpose = body.purpose ?? body.fileType;
    const updated = await prisma.attachment.update({
      where: { id },
      data: {
        fileType: purpose !== undefined ? purpose : attachment.fileType,
        confirmed: body.confirmed !== undefined ? body.confirmed : attachment.confirmed,
      },
    });

    await logAudit({
      type: 'ATTACHMENT_UPLOADED',
      userId: user.id,
      entityType: 'Attachment',
      entityId: id,
      payload: { action: 'updated', purpose: updated.fileType, note: body.note ?? null },
    });

    return {
      attachment: {
        ...updated,
        purpose: updated.fileType,
        url: `/uploads/${updated.filePath}`,
      },
    };
  });

  app.delete('/:id', { preHandler: [app.authenticate] }, async (request, reply) => {
    const user = request.user as AuthUser;
    const { id } = request.params as { id: string };

    const attachment = await prisma.attachment.findUnique({ where: { id } });
    if (!attachment) {
      return reply.status(404).send({ error: { code: 'NOT_FOUND', message: '附件不存在' } });
    }

    // Soft-unlink from visit: keep audit trail by retaining row without visit link is weaker;
    // hard-delete file + mark as unlinked by nulling visit and renaming fileName prefix.
    const fs = await import('node:fs/promises');
    try {
      await fs.unlink(path.join(uploadDir, attachment.filePath));
    } catch {
      // file may already be gone
    }

    await prisma.attachment.delete({ where: { id } });

    // Void related visit inputs that reference this attachment
    if (attachment.monitoringVisitId) {
      const related = await prisma.visitInput.findMany({
        where: {
          monitoringVisitId: attachment.monitoringVisitId,
          isVoided: false,
          content: { contains: attachment.fileName },
        },
      });
      for (const input of related) {
        await prisma.visitInput.update({
          where: { id: input.id },
          data: {
            isVoided: true,
            voidedAt: new Date(),
            voidReason: '关联附件已删除',
            voidedById: user.id,
            status: 'VOIDED',
          },
        });
      }
    }

    await logAudit({
      type: 'ATTACHMENT_UPLOADED',
      userId: user.id,
      entityType: 'Attachment',
      entityId: id,
      payload: { action: 'deleted', fileName: attachment.fileName },
    });

    return { deleted: true };
  });

  app.get('/:id', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const attachment = await prisma.attachment.findUnique({ where: { id } });

    if (!attachment) {
      return reply.status(404).send({ error: { code: 'NOT_FOUND', message: '附件不存在' } });
    }

    return {
      attachment: {
        ...attachment,
        url: `/uploads/${attachment.filePath}`,
      },
    };
  });

  app.get('/visit/:visitId', { preHandler: [app.authenticate] }, async (request) => {
    const { visitId } = request.params as { visitId: string };
    const attachments = await prisma.attachment.findMany({
      where: { monitoringVisitId: visitId },
      orderBy: { createdAt: 'asc' },
    });

    return {
      attachments: attachments.map((a) => ({
        id: a.id,
        fileName: a.fileName,
        mimeType: a.mimeType,
        fileSize: a.fileSize,
        fileType: a.fileType,
        confirmed: a.confirmed,
        sensitiveFlag: a.sensitiveFlag,
        url: `/uploads/${a.filePath}`,
        createdAt: a.createdAt.toISOString(),
      })),
    };
  });
}
