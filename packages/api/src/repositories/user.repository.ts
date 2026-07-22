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
