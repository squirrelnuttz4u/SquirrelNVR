import nodemailer, { Transporter } from 'nodemailer';
import fs from 'fs';
import path from 'path';
import webpush from 'web-push';
import logger from '../../utils/logger';
import { AppDataSource } from '../../database';
import { SystemSettings, Alarm, AlarmEvent, Camera, PushSubscription } from '../../database/entities';
import { AlarmSeverity } from '../../../shared/types';
import axios from 'axios';

export class NotificationService {
  private emailTransporter?: Transporter;
  private vapidPublicKey?: string;
  private pushReady: boolean = false;

  constructor() {}

  /**
   * Initialize notification service
   */
  async initialize(): Promise<void> {
    await this.loadEmailSettings();
    this.initializePush();
    logger.info('✓ Notification service initialized');
  }

  /**
   * Configure Web Push using VAPID keys. Keys come from the environment, or
   * are generated once and persisted under data/ so subscriptions remain valid
   * across restarts.
   */
  private initializePush(): void {
    try {
      let publicKey = process.env.VAPID_PUBLIC_KEY;
      let privateKey = process.env.VAPID_PRIVATE_KEY;

      if (!publicKey || !privateKey) {
        const dataDir = path.join(__dirname, '../../../../data');
        if (!fs.existsSync(dataDir)) {
          fs.mkdirSync(dataDir, { recursive: true });
        }
        const vapidPath = path.join(dataDir, '.vapid.json');

        if (fs.existsSync(vapidPath)) {
          const saved = JSON.parse(fs.readFileSync(vapidPath, 'utf8'));
          publicKey = saved.publicKey;
          privateKey = saved.privateKey;
        } else {
          const keys = webpush.generateVAPIDKeys();
          publicKey = keys.publicKey;
          privateKey = keys.privateKey;
          fs.writeFileSync(vapidPath, JSON.stringify(keys), { mode: 0o600 });
          logger.info('Generated new VAPID keys for push notifications');
        }
      }

      const subject = process.env.VAPID_SUBJECT || 'mailto:admin@squirrelnvr.local';
      webpush.setVapidDetails(subject, publicKey!, privateKey!);
      this.vapidPublicKey = publicKey;
      this.pushReady = true;
      logger.info('✓ Push notifications configured');
    } catch (error) {
      this.pushReady = false;
      logger.warn('Push notifications unavailable:', error);
    }
  }

  /**
   * The public VAPID key clients need to create a subscription.
   */
  getVapidPublicKey(): string | undefined {
    return this.vapidPublicKey;
  }

  isPushReady(): boolean {
    return this.pushReady;
  }

  /**
   * Send a push notification to every stored subscription. Subscriptions that
   * the push service reports as gone (404/410) are pruned.
   */
  async sendPush(payload: { title: string; body: string; data?: any }): Promise<number> {
    if (!this.pushReady) {
      logger.debug('Push not configured, skipping push notification');
      return 0;
    }

    const repo = AppDataSource.getRepository(PushSubscription);
    const subscriptions = await repo.find();
    if (subscriptions.length === 0) {
      return 0;
    }

    const body = JSON.stringify(payload);
    let sent = 0;

    await Promise.all(
      subscriptions.map(async (sub) => {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            body
          );
          sent++;
        } catch (error: any) {
          const status = error?.statusCode;
          if (status === 404 || status === 410) {
            // Subscription no longer valid — remove it.
            await repo.delete({ id: sub.id });
          } else {
            logger.warn(`Failed to send push to ${sub.endpoint.substring(0, 40)}...: ${error?.message || error}`);
          }
        }
      })
    );

    if (sent > 0) {
      logger.info(`Sent push notification to ${sent} subscription(s)`);
    }
    return sent;
  }

  /**
   * Load email settings from database
   */
  private async loadEmailSettings(): Promise<void> {
    try {
      const settingsRepo = AppDataSource.getRepository(SystemSettings);
      const settings = await settingsRepo.findOne({ where: {} });

      if (settings && settings.smtpHost && settings.emailEnabled !== false) {
        this.emailTransporter = nodemailer.createTransport({
          host: settings.smtpHost,
          port: settings.smtpPort,
          secure: settings.smtpSecure,
          auth: settings.smtpUser && settings.smtpPassword ? {
            user: settings.smtpUser,
            pass: settings.smtpPassword,
          } : undefined,
          // Bound connection attempts so an unreachable SMTP server can never
          // hang the process (defaults are minutes long).
          connectionTimeout: 10000,
          greetingTimeout: 10000,
          socketTimeout: 15000,
        });

        // Verify the connection in the background. We intentionally do NOT
        // await this: SMTP verification can take seconds (or time out), and it
        // must never block or fail server startup.
        const transporter = this.emailTransporter;
        transporter.verify()
          .then(() => logger.info('✓ Email service configured and verified'))
          .catch((error) => logger.warn('Email service configured but verification failed:', error));
      } else {
        // Disabled or unconfigured — ensure any previous transporter is dropped
        // (e.g. after an admin toggles email off and reloads settings).
        this.emailTransporter = undefined;
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
        from: settings?.emailFrom || settings?.smtpFrom || 'SquirrelNVR <noreply@squirrelnvr.local>',
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

      // Send push notification
      if (alarm.sendPush) {
        await this.sendPush({
          title: `🚨 ${alarm.name}`,
          body: event.message,
          data: {
            alarmId: alarm.id,
            cameraId: camera.id,
            eventId: event.id,
            severity: alarm.severity,
            url: '/alarms',
          },
        });
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
