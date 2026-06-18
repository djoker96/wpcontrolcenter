import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { encrypt, decrypt } from '../../common/utils/crypto.utils';
import { IntegrationProvider, IntegrationStatus } from '@wpcc/database';
import { getAgentEncryptionKey } from '../../config/env';

@Injectable()
export class IntegrationsService {
  constructor(private readonly prisma: PrismaService) {}

  getGoogleAuthUrl(): string {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI;
    if (!clientId || !redirectUri) {
      throw new BadRequestException('Google OAuth configurations are missing in environment variables');
    }

    const scopes = [
      'https://www.googleapis.com/auth/analytics.readonly',
      'https://www.googleapis.com/auth/webmasters.readonly',
      'https://www.googleapis.com/auth/userinfo.email',
    ];

    const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    url.searchParams.set('client_id', clientId);
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', scopes.join(' '));
    url.searchParams.set('access_type', 'offline');
    url.searchParams.set('prompt', 'consent'); // Force refresh token on reconnect

    return url.toString();
  }

  async handleGoogleCallback(code: string) {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI;

    if (!clientId || !clientSecret || !redirectUri) {
      throw new BadRequestException('Google OAuth configurations are missing in environment variables');
    }

    // 1. Exchange auth code for tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenResponse.ok) {
      const errorBody = await tokenResponse.text();
      throw new BadRequestException(`Failed to exchange Google OAuth code: ${errorBody}`);
    }

    const tokenData = (await tokenResponse.json()) as any;
    const accessToken = tokenData.access_token;
    const refreshToken = tokenData.refresh_token; // may be undefined if prompt=consent wasn't forced or user already connected
    const expiresIn = tokenData.expires_in; // in seconds

    // 2. Fetch User Info to get email
    const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    let accountEmail: string | null = null;
    if (userInfoResponse.ok) {
      const userInfo = (await userInfoResponse.json()) as any;
      accountEmail = userInfo.email || null;
    }

    const encKey = getAgentEncryptionKey();
    const accessTokenEncrypted = encrypt(accessToken, encKey);
    const refreshTokenEncrypted = refreshToken ? encrypt(refreshToken, encKey) : undefined;
    const expiresAt = new Date(Date.now() + expiresIn * 1000);

    // 3. Upsert Integration Account
    // We update by provider and accountEmail if available, or just create a new one
    let account;
    if (accountEmail) {
      account = await this.prisma.integrationAccount.findFirst({
        where: {
          provider: IntegrationProvider.GOOGLE,
          accountEmail,
        },
      });
    }

    if (account) {
      account = await this.prisma.integrationAccount.update({
        where: { id: account.id },
        data: {
          accessTokenEncrypted,
          ...(refreshTokenEncrypted ? { refreshTokenEncrypted } : {}),
          expiresAt,
          status: IntegrationStatus.ACTIVE,
        },
      });
    } else {
      account = await this.prisma.integrationAccount.create({
        data: {
          provider: IntegrationProvider.GOOGLE,
          accountEmail,
          accessTokenEncrypted,
          refreshTokenEncrypted: refreshTokenEncrypted || '',
          expiresAt,
          status: IntegrationStatus.ACTIVE,
        },
      });
    }

    return {
      success: true,
      accountId: account.id,
      accountEmail: account.accountEmail,
      status: account.status,
    };
  }

  async getValidAccessToken(accountId: string): Promise<string> {
    const account = await this.prisma.integrationAccount.findUnique({
      where: { id: accountId },
    });

    if (!account) {
      throw new NotFoundException(`Integration account with ID ${accountId} not found`);
    }

    const encKey = getAgentEncryptionKey();

    // Check if token is expired or expires in next 60 seconds
    const isExpired = !account.expiresAt || account.expiresAt.getTime() - 60000 < Date.now();

    if (!isExpired) {
      return decrypt(account.accessTokenEncrypted, encKey);
    }

    // Refresh Token
    if (!account.refreshTokenEncrypted) {
      throw new BadRequestException('Refresh token is missing. Please reconnect your Google account.');
    }

    const refreshToken = decrypt(account.refreshTokenEncrypted, encKey);
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      throw new BadRequestException('Google OAuth configurations are missing in environment variables');
    }

    const refreshResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    });

    if (!refreshResponse.ok) {
      // Mark integration as ERROR
      await this.prisma.integrationAccount.update({
        where: { id: accountId },
        data: { status: IntegrationStatus.ERROR },
      });
      const errorBody = await refreshResponse.text();
      throw new BadRequestException(`Failed to refresh Google OAuth token: ${errorBody}`);
    }

    const refreshData = (await refreshResponse.json()) as any;
    const newAccessToken = refreshData.access_token;
    const newExpiresIn = refreshData.expires_in;

    const newAccessTokenEncrypted = encrypt(newAccessToken, encKey);
    const newExpiresAt = new Date(Date.now() + newExpiresIn * 1000);

    await this.prisma.integrationAccount.update({
      where: { id: accountId },
      data: {
        accessTokenEncrypted: newAccessTokenEncrypted,
        expiresAt: newExpiresAt,
        status: IntegrationStatus.ACTIVE,
      },
    });

    return newAccessToken;
  }

  async listGoogleProperties(accountId: string) {
    const accessToken = await this.getValidAccessToken(accountId);

    // 1. Fetch GA4 Account Summaries
    const ga4Res = await fetch('https://analyticsadmin.googleapis.com/v1beta/accountSummaries', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    let ga4Properties: Array<{ id: string; name: string; accountName: string }> = [];
    if (ga4Res.ok) {
      const ga4Data = (await ga4Res.json()) as any;
      if (ga4Data.accountSummaries) {
        for (const account of ga4Data.accountSummaries) {
          const accountName = account.displayName || account.name;
          if (account.propertySummaries) {
            for (const prop of account.propertySummaries) {
              // prop.property is in format 'properties/12345'
              const id = prop.property.replace('properties/', '');
              ga4Properties.push({
                id,
                name: prop.displayName,
                accountName,
              });
            }
          }
        }
      }
    } else {
      console.error(`GA4 Admin API returned error: ${ga4Res.status} ${await ga4Res.text()}`);
    }

    // 2. Fetch GSC Sites
    const gscRes = await fetch('https://www.googleapis.com/webmasters/v3/sites', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    let gscSites: Array<{ siteUrl: string; permissionLevel: string }> = [];
    if (gscRes.ok) {
      const gscData = (await gscRes.json()) as any;
      if (gscData.siteEntry) {
        gscSites = gscData.siteEntry.map((site: any) => ({
          siteUrl: site.siteUrl,
          permissionLevel: site.permissionLevel,
        }));
      }
    } else {
      console.error(`Search Console API returned error: ${gscRes.status} ${await gscRes.text()}`);
    }

    return {
      ga4Properties,
      gscSites,
    };
  }

  async mapSiteProperties(siteId: string, accountId: string, ga4PropertyId: string | null, gscSiteIdentifier: string | null) {
    const site = await this.prisma.site.findUnique({
      where: { id: siteId },
    });

    if (!site) {
      throw new NotFoundException(`Site with ID ${siteId} not found`);
    }

    // Map GA4 and GSC using SiteIntegration model
    await this.prisma.siteIntegration.upsert({
      where: {
        siteId_provider: {
          siteId,
          provider: IntegrationProvider.GOOGLE,
        },
      },
      update: {
        integrationAccountId: accountId,
        externalPropertyId: ga4PropertyId,
        externalSiteIdentifier: gscSiteIdentifier,
        status: IntegrationStatus.ACTIVE,
      },
      create: {
        siteId,
        integrationAccountId: accountId,
        provider: IntegrationProvider.GOOGLE,
        externalPropertyId: ga4PropertyId,
        externalSiteIdentifier: gscSiteIdentifier,
        status: IntegrationStatus.ACTIVE,
      },
    });

    // Also update ga4PropertyId and gscSiteUrl fields in the site table for fast access
    await this.prisma.site.update({
      where: { id: siteId },
      data: {
        ga4PropertyId,
        gscSiteUrl: gscSiteIdentifier,
      },
    });

    return { success: true };
  }

  async findAll() {
    const accounts = await this.prisma.integrationAccount.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        provider: true,
        accountEmail: true,
        status: true,
        createdAt: true,
      },
    });
    return accounts;
  }
}
