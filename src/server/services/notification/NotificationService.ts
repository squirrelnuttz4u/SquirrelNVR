import nodemailer, { Transporter } from 'nodemailer';
import logger from '../../utils/logger';
import { AppDataSource } from '../../database';
import { SystemSettings, Alarm, AlarmEvent, Camera } from '../../database/entities';
import { AlarmSeverity } from '../../../shared/types';
import axios from 'axios';

export class NotificationService {
  private emailTransporter?: Transporter;

  constructor() {}

  /**
   * Initialize notification service
   */
  async initialize(): Promise<void> {
    await this.loadEmailSettings();
    logger.info('✓ Notification service initialized');
  }

  /**
   * Load email settings from database
   */
  private async loadEmailSettings(): Promise<void> {
    try {
      const settingsRepo = AppDataSource.getRepository(SystemSettings);
      const settings = await settingsRepo.findOne({ where: {} });

      if (settings && settings.smtpHost) {
        this.emailTransporter = nodemailer.createTransport({
          host: settings.smtpHost,
          port: settings.smtpPort,
          secure: settings.smtpSecure,
          auth: settings.smtpUser && settings.smtpPassword ? {
            user: settings.smtpUser,
            pass: settings.smtpPassword,
          } : undefined,
        });

        // Verify connection
        try {
          await this.emailTransporter.verify();
          logger.info('✓ Email service configured and verified');
        } catch (error) {
          logger.warn('Email service configured but verification failed:', error);
        }
      } else {
        logger.warn('Email service not configured');
      }
    } catch (error) {
      logger.error('Failed to load email settings:', error);
    }
  }

  /**
   * Send email notification
   */
  async sendEmail(to: string[], subject: string, html: string, attachments?: any[]): Promise<boolean> {
    if (!this.emailTransporter) {
      logger.warn('Email service not configured, cannot send email');
      return false;
    }

    try {
      const settingsRepo = AppDataSource.getRepository(SystemSettings);
      const settings = await settingsRepo.findOne({ where: {} });

      const mailOptions = {
        from: settings?.smtpFrom || 'SquirrelNVR <noreply@squirrelnvr.local>',
        to: to.join(', '),
        subject,
        html,
        attachments,
      };

      const info = await this.emailTransporter.sendMail(mailOptions);
      logger.info(`Email sent: ${info.messageId}`);
      return true;
    } catch (error) {
      logger.error('Failed to send email:', error);
      return false;
    }
  }

  /**
   * Send alarm notification
   */
  async sendAlarmNotification(alarm: Alarm, event: AlarmEvent, camera: Camera): Promise<void> {
    try {
      // Send email notification
      if (alarm.sendEmail && alarm.emailRecipients) {
        const recipients = JSON.parse(alarm.emailRecipients);
        if (recipients.length > 0) {
          await this.sendAlarmEmail(alarm, event, camera, recipients);
        }
      }

      // Send webhook notification
      if (alarm.sendWebhook && alarm.webhookUrl) {
        await this.sendWebhook(alarm.webhookUrl, {
          type: 'alarm',
          alarm: {
            id: alarm.id,
            name: alarm.name,
            severity: alarm.severity,
          },
          event: {
            id: event.id,
            timestamp: event.timestamp,
            message: event.message,
            snapshotPath: event.snapshotPath,
          },
          camera: {
            id: camera.id,
            name: camera.name,
          },
        });
      }
    } catch (error) {
      logger.error('Failed to send alarm notification:', error);
    }
  }

  /**
   * Send alarm email
   */
  private async sendAlarmEmail(
    alarm: Alarm,
    event: AlarmEvent,
    camera: Camera,
    recipients: string[]
  ): Promise<void> {
    const severityColors = {
      [AlarmSeverity.LOW]: '#3498db',
      [AlarmSeverity.MEDIUM]: '#f39c12',
      [AlarmSeverity.HIGH]: '#e67e22',
      [AlarmSeverity.CRITICAL]: '#e74c3c',
    };

    const color = severityColors[alarm.severity];
    const timestamp = new Date(event.timestamp).toLocaleString();

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: ${color}; color: white; padding: 20px; border-radius: 5px 5px 0 0; }
            .content { background: #f9f9f9; padding: 20px; border-radius: 0 0 5px 5px; }
            .detail { margin: 10px 0; }
            .label { font-weight: bold; }
            .snapshot { max-width: 100%; height: auto; margin: 20px 0; border-radius: 5px; }
            .footer { margin-top: 20px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #666; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🚨 Alarm Triggered: ${alarm.name}</h1>
            </div>
            <div class="content">
              <div class="detail">
                <span class="label">Severity:</span> ${alarm.severity.toUpperCase()}
              </div>
              <div class="detail">
                <span class="label">Camera:</span> ${camera.name}
              </div>
              <div class="detail">
                <span class="label">Time:</span> ${timestamp}
              </div>
              <div class="detail">
                <span class="label">Message:</span> ${event.message}
              </div>
              ${event.snapshotPath ? `
                <div class="detail">
                  <span class="label">Snapshot:</span><br>
                  <img src="cid:snapshot" class="snapshot" alt="Event Snapshot">
                </div>
              ` : ''}
              <div class="footer">
                This is an automated message from SquirrelNVR. Please do not reply to this email.
              </div>
            </div>
          </div>
        </body>
      </html>
    `;

    const attachments = [];
    if (event.snapshotPath) {
      attachments.push({
        filename: 'snapshot.jpg',
        path: event.snapshotPath,
        cid: 'snapshot',
      });
    }

    await this.sendEmail(
      recipients,
      `🚨 Alarm: ${alarm.name} - ${camera.name}`,
      html,
      attachments
    );
  }

  /**
   * Send webhook notification
   */
  async sendWebhook(url: string, data: any): Promise<boolean> {
    try {
      const response = await axios.post(url, data, {
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'SquirrelNVR/1.0',
        },
        timeout: 10000,
      });

      if (response.status >= 200 && response.status < 300) {
        logger.info(`Webhook sent successfully to ${url}`);
        return true;
      } else {
        logger.warn(`Webhook returned status ${response.status}`);
        return false;
      }
    } catch (error) {
      logger.error(`Failed to send webhook to ${url}:`, error);
      return false;
    }
  }

  /**
   * Send test email
   */
  async sendTestEmail(to: string): Promise<boolean> {
    const html = `
      <h1>Test Email from SquirrelNVR</h1>
      <p>This is a test email to verify your email configuration.</p>
      <p>If you received this email, your email settings are working correctly!</p>
      <p><strong>Timestamp:</strong> ${new Date().toLocaleString()}</p>
    `;

    return await this.sendEmail([to], 'SquirrelNVR - Test Email', html);
  }

  /**
   * Reload email settings
   */
  async reloadSettings(): Promise<void> {
    await this.loadEmailSettings();
  }
}

export default new NotificationService();
