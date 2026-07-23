import bcrypt from 'bcrypt';
import type { IUserRepository, UserEntity } from '../repositories/user.repository.js';

export class AuthService {
  private userRepo: IUserRepository;

  constructor(userRepo: IUserRepository) {
    this.userRepo = userRepo;
  }

  async register(email: string, passwordHash: string, name: string): Promise<UserEntity> {
    const existing = await this.userRepo.findByEmail(email);
    if (existing) {
      throw new Error('User already exists');
    }

    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(passwordHash, salt);

    return this.userRepo.create({
      email,
      passwordHash: hash,
      name,
      avatarUrl: null,
      provider: 'email',
      providerId: null,
    });
  }

  async authenticate(email: string, passwordPlain: string): Promise<UserEntity> {
    const user = await this.userRepo.findByEmail(email);
    if (!user || !user.passwordHash) {
      throw new Error('Invalid credentials');
    }

    const isValid = await bcrypt.compare(passwordPlain, user.passwordHash);
    if (!isValid) {
      throw new Error('Invalid credentials');
    }

    return user;
  }

  async handleSocialLogin(provider: string, providerId: string, email: string, name: string, avatarUrl: string): Promise<UserEntity> {
    let user = await this.userRepo.findByProvider(provider, providerId);
    if (user) {
      return user;
    }

    user = await this.userRepo.findByEmail(email);
    if (user) {
      const updated = await this.userRepo.update(user.id, {
        provider,
        providerId,
        avatarUrl: avatarUrl || user.avatarUrl,
      });
      return updated || user;
    }

    return this.userRepo.create({
      email,
      passwordHash: null,
      name,
      avatarUrl,
      provider,
      providerId,
    });
  }
}
