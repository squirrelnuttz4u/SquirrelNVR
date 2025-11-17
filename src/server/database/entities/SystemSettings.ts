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

  @UpdateDateColumn()
  updatedAt!: Date;
}
