import { Inject, Injectable } from '@nestjs/common';
import type { SendMailOptions } from 'nodemailer';

export const MAIL_TRANSPORT = Symbol('MAIL_TRANSPORT');
export const MAIL_FROM = Symbol('MAIL_FROM');
export const WEB_URL = Symbol('WEB_URL');

export interface MailTransport {
  sendMail(message: SendMailOptions): Promise<unknown> | unknown;
}

@Injectable()
export class MailService {
  constructor(
    @Inject(MAIL_TRANSPORT) private readonly transport: MailTransport,
    @Inject(MAIL_FROM) private readonly from: string,
    @Inject(WEB_URL) private readonly webUrl: string,
  ) {}

  async sendVerificationCode(to: string, code: string): Promise<void> {
    await this.transport.sendMail({
      from: this.from,
      to,
      subject: 'Verify your WP Control Center email',
      text: `Your WP Control Center verification code is ${code}. It expires in 10 minutes. If you did not create this account, ignore this email.`,
      html: `<p>Your WP Control Center verification code is:</p><p style="font-size:28px;font-weight:700;letter-spacing:6px">${code}</p><p>It expires in 10 minutes. If you did not create this account, ignore this email.</p>`,
    });
  }

  async sendPasswordResetLink(to: string, rawToken: string): Promise<void> {
    const url = new URL('/', this.webUrl);
    url.searchParams.set('mode', 'reset-password');
    url.searchParams.set('token', rawToken);
    const link = url.toString();

    await this.transport.sendMail({
      from: this.from,
      to,
      subject: 'Reset your WP Control Center password',
      text: `Reset your password within one hour: ${link}\n\nIf you did not request this reset, ignore this email.`,
      html: `<p>Reset your password within one hour:</p><p><a href="${link}">Reset password</a></p><p>If you did not request this reset, ignore this email.</p>`,
    });
  }
}
