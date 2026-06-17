import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CreateSiteDto } from './dto/create-site.dto';
import { UpdateSiteDto } from './dto/update-site.dto';
import { encrypt } from '../../common/utils/crypto.utils';
import { randomBytes } from 'node:crypto';

@Injectable()
export class SitesService {
  constructor(private readonly prisma: PrismaService) {}

  private getEncryptionKey(): string {
    return process.env.AGENT_ENCRYPTION_KEY || '6a66632c253d82a17cb0b51de38e8cb554c8651a24d852a35368a5436d4f9bf3';
  }

  async create(createSiteDto: CreateSiteDto) {
    const connectionToken = `wpcc_tok_${randomBytes(16).toString('hex')}`;
    const publicKey = `pub_${randomBytes(12).toString('hex')}`;
    const secretKey = randomBytes(16).toString('hex');

    const encKey = this.getEncryptionKey();
    const connectionTokenEncrypted = encrypt(connectionToken, encKey);
    const secretKeyEncrypted = encrypt(secretKey, encKey);

    const site = await this.prisma.site.create({
      data: {
        name: createSiteDto.name,
        domain: createSiteDto.domain,
        siteUrl: createSiteDto.siteUrl,
        environment: createSiteDto.environment,
        credential: {
          create: {
            publicKey,
            secretKeyEncrypted,
            connectionTokenEncrypted,
          },
        },
        setting: {
          create: {
            heartbeatIntervalMinutes: 5,
            uptimeCheckEnabled: true,
            analyticsSyncEnabled: true,
            allowPluginInstall: true,
            allowPluginDelete: true,
            allowThemeDelete: true,
            allowFileEdit: true,
          },
        },
      },
      include: {
        setting: true,
      },
    });

    return {
      ...site,
      connectionToken,
    };
  }

  async findAll() {
    return this.prisma.site.findMany({
      include: {
        setting: true,
        coreVersion: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const site = await this.prisma.site.findUnique({
      where: { id },
      include: {
        setting: true,
        coreVersion: true,
        plugins: true,
        themes: true,
        uptimeChecks: {
          orderBy: { checkedAt: 'desc' },
          take: 20,
        },
        incidents: {
          orderBy: { startedAt: 'desc' },
          take: 10,
        },
      },
    });

    if (!site) {
      throw new NotFoundException(`Site with ID ${id} not found`);
    }

    return site;
  }

  async update(id: string, updateSiteDto: UpdateSiteDto) {
    await this.findOne(id);
    
    return this.prisma.site.update({
      where: { id },
      data: {
        name: updateSiteDto.name,
        domain: updateSiteDto.domain,
        siteUrl: updateSiteDto.siteUrl,
        environment: updateSiteDto.environment,
        status: updateSiteDto.status,
      },
      include: {
        setting: true,
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.site.delete({
      where: { id },
    });
  }

  async generateConnectionToken(id: string) {
    await this.findOne(id);
    const connectionToken = `wpcc_tok_${randomBytes(16).toString('hex')}`;
    const encKey = this.getEncryptionKey();
    const connectionTokenEncrypted = encrypt(connectionToken, encKey);

    await this.prisma.siteCredential.update({
      where: { siteId: id },
      data: {
        connectionTokenEncrypted,
      },
    });

    return {
      siteId: id,
      connectionToken,
    };
  }

  async rotateSecret(id: string) {
    await this.findOne(id);
    const publicKey = `pub_${randomBytes(12).toString('hex')}`;
    const secretKey = randomBytes(16).toString('hex');
    const encKey = this.getEncryptionKey();
    const secretKeyEncrypted = encrypt(secretKey, encKey);

    await this.prisma.siteCredential.update({
      where: { siteId: id },
      data: {
        publicKey,
        secretKeyEncrypted,
        lastRotatedAt: new Date(),
      },
    });

    return {
      siteId: id,
      publicKey,
      secretKey,
    };
  }
}
