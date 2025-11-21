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

  // Audio settings
  @Column({ default: true })
  audioEnabled!: boolean;

  @Column({ nullable: true })
  audioCodec?: string;

  @Column({ default: false })
  twoWayAudio!: boolean;

  // PTZ settings
  @Column({ default: false })
  supportsPTZ!: boolean;

  @Column({ nullable: true })
  ptzType?: string;

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

  @Column({ type: 'text', default: '[]' })
  filteredDetectionClasses!: string; // JSON array - only detect these classes

  // Schedule
  @Column({ type: 'text', nullable: true })
  recordingSchedule?: string; // JSON

  // Video transformation settings
  @Column({ default: 0 })
  rotation!: number; // 0, 90, 180, 270 degrees

  @Column({ default: false })
  flipHorizontal!: boolean;

  @Column({ default: false })
  flipVertical!: boolean;

  @Column({ default: 1.0 })
  brightness!: number; // 0.0 to 2.0, 1.0 is normal

  @Column({ default: 1.0 })
  contrast!: number; // 0.0 to 2.0, 1.0 is normal

  @Column({ default: 1.0 })
  saturation!: number; // 0.0 to 2.0, 1.0 is normal

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
