import { Entity, PrimaryGeneratedColumn, Column, UpdateDateColumn } from 'typeorm';

@Entity('system_settings')
export class SystemSettings {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  // Storage
  @Column({ default: './recordings' })
  storagePath!: string;

  @Column({ default: 500 })
  maxStorageGB!: number;

  @Column({ default: 30 })
  defaultRetentionDays!: number;

  @Column({ default: true })
  autoDeleteOldRecordings!: boolean;

  // Performance
  @Column({ default: 32 })
  maxConcurrentStreams!: number;

  @Column({ default: 5 })
  motionDetectionFps!: number;

  @Column({ default: 2 })
  aiDetectionFps!: number;

  // GPU
  @Column({ default: 'nvidia' })
  gpuType!: string;

  @Column({ default: 'cuda' })
  hardwareAccel!: string;

  // Email
  @Column({ default: '' })
  smtpHost!: string;

  @Column({ default: 587 })
  smtpPort!: number;

  @Column({ default: false })
  smtpSecure!: boolean;

  @Column({ default: '' })
  smtpUser!: string;

  @Column({ default: '' })
  smtpPassword!: string;

  @Column({ default: '' })
  smtpFrom!: string;

  @Column({ default: true })
  emailEnabled!: boolean;

  // Address shown in the "From" field (falls back to smtpFrom when empty).
  @Column({ default: '' })
  emailFrom!: string;

  // Recording defaults applied to newly added cameras / used by the UI.
  @Column({ default: 'continuous' })
  defaultRecordingMode!: string;

  @Column({ default: 'h264' })
  defaultVideoCodec!: string;

  @Column({ default: 'aac' })
  defaultAudioCodec!: string;

  @Column({ default: '1920x1080' })
  defaultResolution!: string;

  @Column({ default: 30 })
  defaultFrameRate!: number;

  // AI defaults
  @Column({ default: './models' })
  aiModelPath!: string;

  @Column({ type: 'real', default: 0.7 })
  aiConfidenceThreshold!: number;

  @Column({ default: true })
  aiEnabled!: boolean;

  @Column({ type: 'simple-json', nullable: true })
  aiDetectionTypes!: string[] | null;

  // Push notifications
  @Column({ default: false })
  pushEnabled!: boolean;

  @UpdateDateColumn()
  updatedAt!: Date;
}
