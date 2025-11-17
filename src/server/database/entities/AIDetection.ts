import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { Camera } from './Camera';
import { Recording } from './Recording';
import { DetectionType, AIProvider } from '../../../shared/types';
import { LicensePlate } from './LicensePlate';

@Entity('ai_detections')
export class AIDetection {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  cameraId!: string;

  @ManyToOne(() => Camera, camera => camera.detections, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'cameraId' })
  camera!: Camera;

  @Column({ nullable: true })
  recordingId?: string;

  @ManyToOne(() => Recording, recording => recording.detections, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'recordingId' })
  recording?: Recording;

  @Column()
  timestamp!: Date;

  @Column({ type: 'text' })
  detectionType!: DetectionType;

  @Column({ type: 'real' })
  confidence!: number;

  @Column()
  label!: string;

  @Column({ type: 'text', nullable: true })
  boundingBox?: string; // JSON

  @Column({ nullable: true })
  snapshotPath?: string;

  @Column({ type: 'text', nullable: true })
  metadata?: string; // JSON

  @Column({ type: 'text' })
  provider!: AIProvider;

  @Column()
  modelName!: string;

  @CreateDateColumn()
  createdAt!: Date;

  @OneToMany(() => LicensePlate, plate => plate.detection)
  licensePlates!: LicensePlate[];
}
