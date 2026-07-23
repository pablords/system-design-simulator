import { eq, and } from 'drizzle-orm';
import { db, schema } from '../db/index.js';

export interface UserEntity {
  id: string;
  email: string;
  passwordHash: string | null;
  name: string | null;
  avatarUrl: string | null;
  provider: string;
  providerId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface IUserRepository {
  findByEmail(email: string): Promise<UserEntity | null>;
  findById(id: string): Promise<UserEntity | null>;
  findByProvider(provider: string, providerId: string): Promise<UserEntity | null>;
  create(user: Omit<UserEntity, 'id' | 'createdAt' | 'updatedAt'>): Promise<UserEntity>;
  update(id: string, updateData: Partial<Omit<UserEntity, 'id' | 'createdAt'>>): Promise<UserEntity | null>;
}

export class DrizzleUserRepository implements IUserRepository {
  async findByEmail(email: string): Promise<UserEntity | null> {
    const [user] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, email.toLowerCase()))
      .limit(1);
    return user || null;
  }

  async findById(id: string): Promise<UserEntity | null> {
    const [user] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, id))
      .limit(1);
    return user || null;
  }

  async findByProvider(provider: string, providerId: string): Promise<UserEntity | null> {
    const [user] = await db
      .select()
      .from(schema.users)
      .where(and(eq(schema.users.provider, provider), eq(schema.users.providerId, providerId)))
      .limit(1);
    return user || null;
  }

  async create(user: Omit<UserEntity, 'id' | 'createdAt' | 'updatedAt'>): Promise<UserEntity> {
    const [inserted] = await db
      .insert(schema.users)
      .values({
        email: user.email.toLowerCase(),
        passwordHash: user.passwordHash,
        name: user.name ?? 'User',
        avatarUrl: user.avatarUrl,
        provider: user.provider,
        providerId: user.providerId,
      })
      .returning();
    return inserted;
  }

  async update(id: string, updateData: Partial<Omit<UserEntity, 'id' | 'createdAt'>>): Promise<UserEntity | null> {
    const setPayload: Record<string, any> = {
      ...updateData,
      updatedAt: new Date(),
    };
    if (setPayload.name === null) {
      delete setPayload.name;
    }

    const [updated] = await db
      .update(schema.users)
      .set(setPayload)
      .where(eq(schema.users.id, id))
      .returning();
    return updated || null;
  }
}

export class InMemoryUserRepository implements IUserRepository {
  private users: UserEntity[] = [];

  async findByEmail(email: string): Promise<UserEntity | null> {
    return this.users.find((u) => u.email.toLowerCase() === email.toLowerCase()) || null;
  }

  async findById(id: string): Promise<UserEntity | null> {
    return this.users.find((u) => u.id === id) || null;
  }

  async findByProvider(provider: string, providerId: string): Promise<UserEntity | null> {
    return this.users.find((u) => u.provider === provider && u.providerId === providerId) || null;
  }

  async create(user: Omit<UserEntity, 'id' | 'createdAt' | 'updatedAt'>): Promise<UserEntity> {
    const newUser: UserEntity = {
      ...user,
      id: `user_${Math.random().toString(36).substring(2, 9)}`,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.users.push(newUser);
    return newUser;
  }

  async update(id: string, updateData: Partial<Omit<UserEntity, 'id' | 'createdAt'>>): Promise<UserEntity | null> {
    const index = this.users.findIndex((u) => u.id === id);
    if (index === -1) return null;

    this.users[index] = {
      ...this.users[index],
      ...updateData,
      updatedAt: new Date(),
    };
    return this.users[index];
  }
}
