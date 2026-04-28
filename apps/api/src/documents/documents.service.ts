import { HttpStatus, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { promises as fs } from 'fs';
import { extname, resolve } from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { BusinessErrorCode } from '../common/errors/business-error-code';
import { BusinessException } from '../common/errors/business-exception';
import { DocumentCategory, HouseholdRole, PlanTier } from '../common/types/roles';
import { PlansService } from '../plans/plans.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDocumentDto } from './dto/create-document.dto';

type ListDocumentsFilters = {
  category?: DocumentCategory;
  ownerMemberId?: string;
  search?: string;
};

type RateLimitAction = 'upload' | 'download';

@Injectable()
export class DocumentsService implements OnModuleInit {
  private readonly execFileAsync = promisify(execFile);
  private readonly rateLimitEvents = new Map<string, number[]>();
  private readonly logger = new Logger(DocumentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly plansService: PlansService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.validateAntivirusConfiguration();
  }

  async listMembers(householdId: string, userId: string) {
    await this.ensureMembership(householdId, userId);

    const members = await this.prisma.householdMember.findMany({
      where: { householdId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    return members.map((member: (typeof members)[number]) => ({
      id: member.id,
      role: member.role,
      user: member.user,
    }));
  }

  async listByHousehold(householdId: string, userId: string, filters: ListDocumentsFilters) {
    await this.ensureMembership(householdId, userId);

    const totalCount = await this.prisma.document.count({
      where: { householdId },
    });

    const documents = await this.prisma.document.findMany({
      where: {
        householdId,
        ...(filters.category ? { category: filters.category } : {}),
        ...(filters.ownerMemberId ? { ownerMemberId: filters.ownerMemberId } : {}),
        ...(filters.search
          ? {
              OR: [
                {
                  title: {
                    contains: filters.search,
                    mode: 'insensitive',
                  },
                },
                {
                  notes: {
                    contains: filters.search,
                    mode: 'insensitive',
                  },
                },
              ],
            }
          : {}),
      },
      include: {
        ownerMember: {
          include: {
            user: {
              select: { id: true, name: true, email: true },
            },
          },
        },
      },
      orderBy: [{ expiresAt: 'asc' }, { createdAt: 'desc' }],
      take: 100,
    });

    return {
      totalCount,
      items: documents.map((document: (typeof documents)[number]) => ({
        id: document.id,
        title: document.title,
        category: document.category,
        notes: document.notes,
        expiresAt: document.expiresAt,
        createdAt: document.createdAt,
        originalFileName: document.originalFileName,
        mimeType: document.mimeType,
        sizeBytes: document.sizeBytes,
        downloadPath: `/documents/${document.id}/download`,
        ownerMember: {
          id: document.ownerMember.id,
          role: document.ownerMember.role,
          user: document.ownerMember.user,
        },
      })),
    };
  }

  async create(
    householdId: string,
    userId: string,
    body: CreateDocumentDto,
    file: Express.Multer.File,
  ) {
    this.enforceRateLimit(userId, 'upload');
    await this.validateUploadedPdfFile(file);

    const membership = await this.ensureMembership(householdId, userId);
    if (membership.role === HouseholdRole.VIEWER) {
      throw new BusinessException(
        BusinessErrorCode.SEM_PERMISSAO_DOCUMENTO,
        'Você não tem permissão para cadastrar documentos neste lar.',
        HttpStatus.FORBIDDEN,
      );
    }

    const ownerMember = await this.prisma.householdMember.findUnique({
      where: {
        id: body.ownerMemberId,
      },
      select: {
        id: true,
        householdId: true,
      },
    });
    if (!ownerMember || ownerMember.householdId !== householdId) {
      throw new BusinessException(
        BusinessErrorCode.MEMBRO_DOCUMENTO_INVALIDO,
        'Membro selecionado não pertence ao lar informado.',
        HttpStatus.BAD_REQUEST,
      );
    }

    const household = await this.prisma.household.findUnique({
      where: { id: householdId },
      select: { ownerUserId: true },
    });
    if (!household) {
      throw new BusinessException(
        BusinessErrorCode.LAR_NAO_ENCONTRADO,
        'Lar não encontrado.',
        HttpStatus.NOT_FOUND,
      );
    }

    const plan = await this.plansService.getPlanForUser(household.ownerUserId);
    const documentsLimit = this.getDocumentsLimit(plan);
    const documentsCount = await this.prisma.document.count({
      where: { householdId },
    });
    if (documentsCount >= documentsLimit) {
      throw new BusinessException(
        BusinessErrorCode.PLANO_LIMITE_DOCUMENTOS,
        `Limite do plano atingido: ${documentsLimit} documento(s) permitido(s) neste lar.`,
        HttpStatus.FORBIDDEN,
      );
    }

    try {
      const document = await this.prisma.document.create({
        data: {
          householdId,
          ownerMemberId: body.ownerMemberId,
          uploadedByUserId: userId,
          title: body.title,
          category: body.category,
          notes: body.notes ?? null,
          originalFileName: file.originalname,
          mimeType: file.mimetype,
          sizeBytes: file.size,
          storagePath: file.path,
          expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
        },
        include: {
          ownerMember: {
            include: {
              user: {
                select: { id: true, name: true, email: true },
              },
            },
          },
        },
      });

      return {
        ...document,
        downloadPath: `/documents/${document.id}/download`,
      };
    } catch (error) {
      await this.safeDeleteUploadedFile(file.path);
      throw error;
    }
  }

  async getDownloadInfo(documentId: string, userId: string) {
    this.enforceRateLimit(userId, 'download');

    const document = await this.prisma.document.findUnique({
      where: { id: documentId },
      include: {
        ownerMember: {
          select: { householdId: true },
        },
      },
    });

    if (!document || !document.ownerMember) {
      throw new BusinessException(
        BusinessErrorCode.DOCUMENTO_ARQUIVO_INDISPONIVEL,
        'Documento não encontrado.',
        HttpStatus.NOT_FOUND,
      );
    }

    await this.ensureMembership(document.ownerMember.householdId, userId);

    if (!document.storagePath || !document.originalFileName || !document.mimeType) {
      throw new BusinessException(
        BusinessErrorCode.DOCUMENTO_ARQUIVO_INDISPONIVEL,
        'Arquivo do documento indisponível.',
        HttpStatus.NOT_FOUND,
      );
    }

    const expectedUploadsRoot = resolve(process.cwd(), 'uploads', 'documents');
    const absoluteStoragePath = resolve(document.storagePath);
    if (!absoluteStoragePath.startsWith(expectedUploadsRoot)) {
      throw new BusinessException(
        BusinessErrorCode.DOCUMENTO_ARQUIVO_INDISPONIVEL,
        'Arquivo do documento indisponível.',
        HttpStatus.NOT_FOUND,
      );
    }
    try {
      await fs.access(absoluteStoragePath);
    } catch {
      throw new BusinessException(
        BusinessErrorCode.DOCUMENTO_ARQUIVO_INDISPONIVEL,
        'Arquivo do documento indisponível.',
        HttpStatus.NOT_FOUND,
      );
    }

    return {
      storagePath: absoluteStoragePath,
      originalFileName: document.originalFileName,
      mimeType: document.mimeType,
    };
  }

  private async validateUploadedPdfFile(file: Express.Multer.File): Promise<void> {
    if (!file || !file.path) {
      throw new BusinessException(
        BusinessErrorCode.ARQUIVO_INVALIDO,
        'Envie um arquivo PDF válido.',
        HttpStatus.BAD_REQUEST,
      );
    }

    const maxBytes = 8 * 1024 * 1024;
    if (file.size > maxBytes) {
      await this.safeDeleteUploadedFile(file.path);
      throw new BusinessException(
        BusinessErrorCode.ARQUIVO_INVALIDO,
        'Arquivo inválido. Envie um PDF de até 8MB.',
        HttpStatus.BAD_REQUEST,
      );
    }

    const hasPdfExtension = extname(file.originalname || '').toLowerCase() === '.pdf';
    const isPdfMime = (file.mimetype || '').toLowerCase() === 'application/pdf';
    if (!hasPdfExtension && !isPdfMime) {
      await this.safeDeleteUploadedFile(file.path);
      throw new BusinessException(
        BusinessErrorCode.ARQUIVO_INVALIDO,
        'Arquivo inválido. Envie um PDF válido.',
        HttpStatus.BAD_REQUEST,
      );
    }

    const expectedUploadsRoot = resolve(process.cwd(), 'uploads', 'documents');
    const absoluteStoragePath = resolve(file.path);
    if (!absoluteStoragePath.startsWith(expectedUploadsRoot)) {
      await this.safeDeleteUploadedFile(file.path);
      throw new BusinessException(
        BusinessErrorCode.ARQUIVO_INVALIDO,
        'Arquivo inválido. Local de armazenamento não permitido.',
        HttpStatus.BAD_REQUEST,
      );
    }

    let fd: fs.FileHandle | null = null;
    try {
      fd = await fs.open(absoluteStoragePath, 'r');
      const signatureBuffer = Buffer.alloc(5);
      await fd.read(signatureBuffer, 0, 5, 0);
      const pdfSignature = signatureBuffer.toString('utf8');
      if (pdfSignature !== '%PDF-') {
        await this.safeDeleteUploadedFile(file.path);
        throw new BusinessException(
          BusinessErrorCode.ARQUIVO_INVALIDO,
          'Arquivo inválido. Conteúdo não reconhecido como PDF.',
          HttpStatus.BAD_REQUEST,
        );
      }

      const validationChunk = Buffer.alloc(1024 * 1024);
      const { bytesRead } = await fd.read(validationChunk, 0, validationChunk.length, 0);
      const contentSample = validationChunk.subarray(0, bytesRead).toString('latin1');
      if (contentSample.includes('/Encrypt') || contentSample.includes('/Filter/Standard')) {
        await this.safeDeleteUploadedFile(file.path);
        throw new BusinessException(
          BusinessErrorCode.ARQUIVO_INVALIDO,
          'PDF criptografado não é permitido por segurança.',
          HttpStatus.BAD_REQUEST,
        );
      }
    } finally {
      await fd?.close();
    }

    await this.scanFileWithAntivirus(file.path);
  }

  private async safeDeleteUploadedFile(path: string): Promise<void> {
    if (!path) return;
    try {
      await fs.unlink(path);
    } catch {
      // arquivo pode não existir; não interromper fluxo principal
    }
  }

  private enforceRateLimit(userId: string, action: RateLimitAction): void {
    const now = Date.now();
    const key = `${action}:${userId}`;
    const current = this.rateLimitEvents.get(key) ?? [];

    const maxEvents = action === 'upload' ? 12 : 80;
    const windowMs = 60 * 1000;
    const filtered = current.filter((timestamp) => now - timestamp < windowMs);
    if (filtered.length >= maxEvents) {
      throw new BusinessException(
        BusinessErrorCode.RATE_LIMIT_ARQUIVOS,
        'Limite de operações com arquivos atingido. Aguarde alguns segundos e tente novamente.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    filtered.push(now);
    this.rateLimitEvents.set(key, filtered);
  }

  private async scanFileWithAntivirus(filePath: string): Promise<void> {
    const command = process.env.CLAMAV_SCAN_COMMAND || 'clamscan';
    const antivirusRequired = process.env.DOCUMENTS_ANTIVIRUS_REQUIRED === 'true';

    try {
      const result = await this.execFileAsync(command, ['--no-summary', '--stdout', filePath], {
        windowsHide: true,
      });
      const combinedOutput = `${result.stdout ?? ''}\n${result.stderr ?? ''}`.toUpperCase();
      if (combinedOutput.includes('FOUND')) {
        await this.safeDeleteUploadedFile(filePath);
        throw new BusinessException(
          BusinessErrorCode.ARQUIVO_INVALIDO,
          'Arquivo rejeitado por análise de segurança (antivírus).',
          HttpStatus.BAD_REQUEST,
        );
      }
    } catch (error) {
      if (error instanceof BusinessException) {
        throw error;
      }

      const errorCode = (error as { code?: number | string }).code;
      if (errorCode === 1) {
        await this.safeDeleteUploadedFile(filePath);
        throw new BusinessException(
          BusinessErrorCode.ARQUIVO_INVALIDO,
          'Arquivo rejeitado por análise de segurança (antivírus).',
          HttpStatus.BAD_REQUEST,
        );
      }

      if (antivirusRequired) {
        await this.safeDeleteUploadedFile(filePath);
        throw new BusinessException(
          BusinessErrorCode.ARQUIVO_INVALIDO,
          'Falha na verificação antivírus. Tente novamente em instantes.',
          HttpStatus.SERVICE_UNAVAILABLE,
        );
      }

      this.logger.warn(
        'Antivírus indisponível durante varredura; upload seguiu por configuração opcional.',
      );
    }
  }

  private async validateAntivirusConfiguration(): Promise<void> {
    const command = process.env.CLAMAV_SCAN_COMMAND || 'clamscan';
    const antivirusRequired = process.env.DOCUMENTS_ANTIVIRUS_REQUIRED === 'true';

    try {
      await this.execFileAsync(command, ['--version'], { windowsHide: true });
      this.logger.log(`Antivírus configurado: comando "${command}" disponível.`);
    } catch {
      const message =
        `Comando de antivírus "${command}" não encontrado. ` +
        'Defina CLAMAV_SCAN_COMMAND corretamente ou instale ClamAV.';

      if (antivirusRequired) {
        throw new BusinessException(
          BusinessErrorCode.ARQUIVO_INVALIDO,
          `${message} Upload bloqueado por política de segurança.`,
          HttpStatus.SERVICE_UNAVAILABLE,
        );
      }

      this.logger.warn(`${message} Modo opcional ativo; uploads seguirão sem varredura.`);
    }
  }

  private getDocumentsLimit(plan: PlanTier): number {
    return plan === PlanTier.PRO ? 200 : 4;
  }

  private async ensureMembership(householdId: string, userId: string) {
    const membership = await this.prisma.householdMember.findUnique({
      where: {
        householdId_userId: {
          householdId,
          userId,
        },
      },
      select: {
        id: true,
        role: true,
      },
    });

    if (!membership) {
      throw new BusinessException(
        BusinessErrorCode.LAR_NAO_ENCONTRADO,
        'Lar não encontrado ou sem permissão de acesso.',
        HttpStatus.NOT_FOUND,
      );
    }

    return membership;
  }
}
