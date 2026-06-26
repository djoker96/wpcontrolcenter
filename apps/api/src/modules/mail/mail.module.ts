import { Module } from '@nestjs/common';
import nodemailer from 'nodemailer';
import { getSmtpConfig, getWebUrl } from '../../config/env';
import { MAIL_FROM, MAIL_TRANSPORT, MailService, WEB_URL } from './mail.service';

@Module({
  providers: [
    {
      provide: MAIL_TRANSPORT,
      useFactory: () => {
        let transport: ReturnType<typeof nodemailer.createTransport> | undefined;
        return {
          sendMail: (message) => {
            const config = getSmtpConfig();
            transport ??= nodemailer.createTransport({
              host: config.host,
              port: config.port,
              secure: config.secure,
              auth: {
                user: config.user,
                pass: config.password,
              },
            });
            return transport.sendMail(message);
          },
        };
      },
    },
    {
      provide: MAIL_FROM,
      useFactory: () => () => getSmtpConfig().from,
    },
    {
      provide: WEB_URL,
      useFactory: () => getWebUrl,
    },
    MailService,
  ],
  exports: [MailService],
})
export class MailModule {}
