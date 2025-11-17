import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Alarm } from './Alarm';
import { Camera } from './Camera';
import { AIDetection } from './AIDetection';
import { AlarmSeverity } from '../../../shared/types';

@Entity('alarm_events')
export class AlarmEvent {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  alarmId!: string;

  @ManyToOne(() => Alarm, alarm => alarm.events, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'alarmId' })
  alarm!: Alarm;

  @Column()
  cameraId!: string;

  @ManyToOne(() => Camera, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'cameraId' })
  camera!: Camera;

  @Column({ nullable: true })
  detectionId?: string;

  @ManyToOne(() => AIDetection, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'detectionId' })
  detection?: AIDetection;

  @Column()
  timestamp!: Date;

  @Column({ type: 'text' })
  severity!: AlarmSeverity;

  @Column()
  message!: string;

  @Column({ default: false })
  acknowledged!: boolean;

  @Column({ nullable: true })
  acknowledgedAt?: Date;

  @Column({ nullable: true })
  acknowledgedBy?: string;

  @Column({ nullable: true })
  snapshotPath?: string;

  @Column({ nullable: true })
  videoPath?: string;

  @CreateDateColumn()
  createdAt!: Date;
}
