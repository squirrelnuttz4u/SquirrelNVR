import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { Camera } from './Camera';
import { AIDetection } from './AIDetection';

@Entity('recordings')
export class Recording {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  cameraId!: string;

  @ManyToOne(() => Camera, camera => camera.recordings, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'cameraId' })
  camera!: Camera;

  @Column()
  startTime!: Date;

  @Column()
  endTime!: Date;

  @Column()
  duration!: number; // seconds

  @Column({ type: 'bigint' })
  fileSize!: number; // bytes

  @Column()
  filePath!: string;

  @Column({ nullable: true })
  thumbnailPath?: string;

  @Column()
  recordingType!: string; // continuous, motion, scheduled, manual

  @Column({ default: false })
  hasAI!: boolean;

  @Column({ default: false })
  hasMotion!: boolean;

  @CreateDateColumn()
  createdAt!: Date;

  @OneToMany(() => AIDetection, detection => detection.recording)
  detections!: AIDetection[];
}
