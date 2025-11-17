import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToMany, JoinTable } from 'typeorm';
import { User } from './User';

@Entity('user_groups')
export class UserGroup {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ unique: true })
  name!: string;

  @Column({ nullable: true })
  description?: string;

  // Permissions
  @Column({ default: false })
  canViewLive!: boolean;

  @Column({ default: false })
  canViewRecordings!: boolean;

  @Column({ default: false })
  canDownloadRecordings!: boolean;

  @Column({ default: false })
  canManageCameras!: boolean;

  @Column({ default: false })
  canManageRecordings!: boolean;

  @Column({ default: false })
  canManageAlarms!: boolean;

  @Column({ default: false })
  canManageUsers!: boolean;

  @Column({ default: false })
  canManageSystem!: boolean;

  @Column({ default: false })
  canControlPTZ!: boolean;

  @Column({ default: false })
  canViewAIDetections!: boolean;

  @Column({ default: false })
  canExportData!: boolean;

  // Camera access control
  @Column({ type: 'text', default: '[]' })
  allowedCameraIds!: string; // JSON array - empty means all cameras

  @Column({ default: false })
  allCamerasAccess!: boolean; // If true, has access to all cameras

  @ManyToMany(() => User, user => user.groups)
  users!: User[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
