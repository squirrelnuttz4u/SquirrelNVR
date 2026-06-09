import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

/**
 * A browser/device Web Push subscription, captured when a user opts in to push
 * notifications from a given device.
 */
@Entity('push_subscriptions')
export class PushSubscription {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  userId!: string;

  // The push service endpoint uniquely identifies a subscription.
  @Index({ unique: true })
  @Column({ type: 'text' })
  endpoint!: string;

  @Column()
  p256dh!: string;

  @Column()
  auth!: string;

  @Column({ nullable: true })
  userAgent?: string;

  @CreateDateColumn()
  createdAt!: Date;
}
