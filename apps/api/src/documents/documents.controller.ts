import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Res,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SuccessCode } from '../common/errors/success-code';
import { DocumentCategory } from '../common/types/roles';
import { CreateDocumentDto } from './dto/create-document.dto';
import { DocumentsService } from './documents.service';
import { createReadStream } from 'fs';
import type { Response } from 'express';

@Controller('documents')
@UseGuards(JwtAuthGuard)
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Get('households/:householdId/members')
  async listMembers(
    @Param('householdId') householdId: string,
    @CurrentUser() user: { userId: string },
  ) {
    return {
      code: SuccessCode.MEMBROS_LAR_LISTADOS,
      message: 'Membros do lar carregados com sucesso.',
      items: await this.documentsService.listMembers(householdId, user.userId),
    };
  }

  @Get('households/:householdId')
  async listByHousehold(
    @Param('householdId') householdId: string,
    @CurrentUser() user: { userId: string },
    @Query('category') category?: DocumentCategory,
    @Query('ownerMemberId') ownerMemberId?: string,
    @Query('search') search?: string,
  ) {
    const result = await this.documentsService.listByHousehold(householdId, user.userId, {
      category,
      ownerMemberId,
      search,
    });

    return {
      code: SuccessCode.DOCUMENTOS_LISTADOS,
      message: 'Documentos carregados com sucesso.',
      totalCount: result.totalCount,
      items: result.items,
    };
  }

  @Post('households/:householdId')
  @UseInterceptors(
    FileInterceptor('file', {
      dest: 'uploads/documents',
    }),
  )
  async create(
    @Param('householdId') householdId: string,
    @CurrentUser() user: { userId: string },
    @Body() body: CreateDocumentDto,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('Arquivo inválido. Envie um PDF de até 8MB.');
    }

    const isPdfMime = file.mimetype?.toLowerCase() === 'application/pdf';
    const hasPdfExtension = file.originalname?.toLowerCase().endsWith('.pdf');
    const isPdfFile = isPdfMime || hasPdfExtension;
    const maxBytes = 8 * 1024 * 1024;
    if (!isPdfFile || file.size > maxBytes) {
      throw new BadRequestException('Arquivo inválido. Envie um PDF de até 8MB.');
    }

    return {
      code: SuccessCode.DOCUMENTO_CRIADO,
      message: 'Documento cadastrado com sucesso.',
      document: await this.documentsService.create(householdId, user.userId, body, file),
    };
  }

  @Get(':documentId/download')
  async download(
    @Param('documentId') documentId: string,
    @CurrentUser() user: { userId: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    const info = await this.documentsService.getDownloadInfo(documentId, user.userId);
    res.setHeader('Content-Type', info.mimeType);
    res.setHeader('Content-Disposition', `inline; filename=\"${info.originalFileName}\"`);
    return new StreamableFile(createReadStream(info.storagePath));
  }
}
