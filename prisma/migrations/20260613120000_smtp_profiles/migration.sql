-- AlterTable
ALTER TABLE "MailSetting" ADD COLUMN "smtpProfilesJson" TEXT DEFAULT '[]';
ALTER TABLE "MailSetting" ADD COLUMN "activeSmtpProfileId" TEXT;
