import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { AlarmSeverity, DetectionType } from '../../../shared/types';
import { AlarmEvent } from './AlarmEvent';

@Entity('alarms')
export class Alarm {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  name!: string;

  @Column({ nullable: true })
  description?: string;

  @Column({ default: true })
  enabled!: boolean;

  @Column({ type: 'text' })
  cameraIds!: string; // JSON array

  // Trigger conditions
  @Column({ default: false })
  triggerOnMotion!: boolean;

  @Column({ default: true })
  triggerOnAI!: boolean;

  @Column({ type: 'text', default: '[]' })
  triggerDetectionTypes!: string; // JSON array of DetectionType

  @Column({ type: 'real', default: 0.5 })
  minimumConfidence!: number;

  // Severity
  @Column({ type: 'text', default: AlarmSeverity.MEDIUM })
  severity!: AlarmSeverity;

  // Actions
  @Column({ default: false })
  sendEmail!: boolean;

  @Column({ type: 'text', default: '[]' })
  emailRecipients!: string; // JSON array

  @Column({ default: false })
  sendWebhook!: boolean;

  @Column({ nullable: true })
  webhookUrl?: string;

  @Column({ default: false })
  sendPush!: boolean;

  @Column({ default: true })
  recordVideo!: boolean;

  @Column({ default: true })
  takeSnapshot!: boolean;

  // Schedule
  @Column({ type: 'text', nullable: true })
  schedule?: string; // JSON

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @OneToMany(() => AlarmEvent, event => event.alarm)
  events!: AlarmEvent[];
}
