import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToMany, JoinTable } from 'typeorm';
import { UserGroup } from './UserGroup';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ unique: true })
  username!: string;

  @Column({ unique: true })
  email!: string;

  @Column()
  password!: string; // hashed

  @Column({ default: 'user' })
  role!: string; // admin, user, viewer

  @Column({ default: true })
  enabled!: boolean;

  // Direct camera access (overrides group permissions)
  @Column({ type: 'text', default: '[]' })
  allowedCameraIds!: string; // JSON array - specific cameras this user can access

  @Column({ default: false })
  allCamerasAccess!: boolean; // If true, user has access to all cameras

  // User groups
  @ManyToMany(() => UserGroup, group => group.users)
  @JoinTable({
    name: 'user_group_members',
    joinColumn: { name: 'userId', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'groupId', referencedColumnName: 'id' }
  })
  groups!: UserGroup[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
