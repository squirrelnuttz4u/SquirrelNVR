import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { Camera } from './Camera';
import { AIDetection } from './AIDetection';

@Entity('license_plates')
export class LicensePlate {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  cameraId!: string;

  @ManyToOne(() => Camera, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'cameraId' })
  camera!: Camera;

  @Column()
  detectionId!: string;

  @ManyToOne(() => AIDetection, detection => detection.licensePlates, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'detectionId' })
  detection!: AIDetection;

  @Index()
  @Column()
  plateNumber!: string;

  @Column({ type: 'real' })
  confidence!: number;

  @Column()
  timestamp!: Date;

  @Column({ nullable: true })
  snapshotPath?: string;

  @Column({ nullable: true })
  vehicleType?: string;

  @Column({ nullable: true })
  vehicleColor?: string;

  @Column({ type: 'text', nullable: true })
  metadata?: string; // JSON

  @CreateDateColumn()
  createdAt!: Date;
}
