import { describe, it, expect } from 'vitest';
import { InMemoryUserRepository, DrizzleUserRepository } from '../repositories/user.repository.js';
import { InMemoryProjectRepository, DrizzleProjectRepository } from '../repositories/project.repository.js';

describe('Repository Implementations', () => {
  describe('InMemoryUserRepository', () => {
    it('should find user by email, id, provider and support update', async () => {
      const repo = new InMemoryUserRepository();
      const user = await repo.create({
        email: 'user@test.com',
        passwordHash: 'hash',
        name: 'User Test',
        avatarUrl: null,
        provider: 'email',
        providerId: null,
      });

      expect(await repo.findByEmail('USER@TEST.COM')).toEqual(user);
      expect(await repo.findById(user.id)).toEqual(user);
      expect(await repo.findByProvider('email', 'none')).toBeNull();

      const updated = await repo.update(user.id, { name: 'Updated Name' });
      expect(updated?.name).toBe('Updated Name');

      expect(await repo.update('non-existent', { name: 'Test' })).toBeNull();
    });
  });

  describe('InMemoryProjectRepository', () => {
    it('should create, find, update, and delete projects', async () => {
      const repo = new InMemoryProjectRepository();
      const project = await repo.create({
        userId: 'u1',
        name: 'Test Project',
        description: 'Desc',
        canvas: { nodes: [], edges: [] },
        isPublic: false,
      });

      expect(await repo.findById(project.id)).toEqual(project);
      expect(await repo.findByUserId('u1')).toEqual([project]);
      expect(await repo.findByUserId('u2')).toEqual([]);

      const updated = await repo.update(project.id, { name: 'Renamed' });
      expect(updated?.name).toBe('Renamed');
      expect(await repo.update('non-existent', { name: 'Foo' })).toBeNull();

      expect(await repo.delete(project.id, 'other_user')).toBe(false);
      expect(await repo.delete(project.id, 'u1')).toBe(true);
      expect(await repo.findById(project.id)).toBeNull();
    });
  });

  describe('Drizzle Repository Classes Instantiate', () => {
    it('should instantiate DrizzleUserRepository and DrizzleProjectRepository', () => {
      const userRepo = new DrizzleUserRepository();
      const projectRepo = new DrizzleProjectRepository();

      expect(userRepo).toBeInstanceOf(DrizzleUserRepository);
      expect(projectRepo).toBeInstanceOf(DrizzleProjectRepository);
    });
  });
});
