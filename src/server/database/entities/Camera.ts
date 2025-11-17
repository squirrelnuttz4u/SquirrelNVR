import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { CameraStatus, StreamType, RecordingMode, AIProvider } from '../../../shared/types';
import { Recording } from './Recording';
import { AIDetection } from './AIDetection';

@Entity('cameras')
export class Camera {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  name!: string;

  @Column({ nullable: true })
  description?: string;

  @Column()
  streamUrl!: string;

  @Column({
    type: 'text',
    default: StreamType.RTSP
  })
  streamType!: StreamType;

  @Column({ nullable: true })
  username?: string;

  @Column({ nullable: true })
  password?: string;

  @Column({
    type: 'text',
    default: CameraStatus.OFFLINE
  })
  status!: CameraStatus;

  @Column({ default: true })
  enabled!: boolean;

  // Recording settings
  @Column({
    type: 'text',
    default: RecordingMode.CONTINUOUS
  })
  recordingMode!: RecordingMode;

  @Column({ default: 'high' })
  recordingQuality!: string;

  @Column({ default: 15 })
  recordingFps!: number;

  @Column({ default: 5 })
  preRecordSeconds!: number;

  @Column({ default: 10 })
  postRecordSeconds!: number;

  // Motion detection
  @Column({ default: true })
  motionEnabled!: boolean;

  @Column({ default: 50 })
  motionSensitivity!: number;

  @Column({ type: 'text', nullable: true })
  motionZones?: string; // JSON

  // AI detection
  @Column({ default: true })
  aiEnabled!: boolean;

  @Column({
    type: 'text',
    default: AIProvider.CODEPROJECT
  })
  aiProvider!: AIProvider;

  @Column({ type: 'text', default: '[]' })
  aiModels!: string; // JSON array

  @Column({ default: 50 })
  aiSensitivity!: number;

  @Column({ type: 'text', nullable: true })
  detectionZones?: string; // JSON

  // Schedule
  @Column({ type: 'text', nullable: true })
  recordingSchedule?: string; // JSON

  // Storage
  @Column({ default: 30 })
  retentionDays!: number;

  @Column({ nullable: true })
  maxStorageGB?: number;

  // Camera info
  @Column({ nullable: true })
  manufacturer?: string;

  @Column({ nullable: true })
  model?: string;

  @Column({ nullable: true })
  firmware?: string;

  @Column({ nullable: true })
  resolution?: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @OneToMany(() => Recording, recording => recording.camera)
  recordings!: Recording[];

  @OneToMany(() => AIDetection, detection => detection.camera)
  detections!: AIDetection[];
}
