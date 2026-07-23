import { describe, it, expect, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { createProjectRoutes } from '../routes/projects.js';
import { InMemoryProjectRepository } from '../repositories/project.repository.js';
import { signToken } from '../lib/jwt.js';
import { errorHandler } from '../middleware/error-handler.js';

describe('Projects Routes Integration Tests', () => {
  let app: Hono;
  let projectRepo: InMemoryProjectRepository;
  let userId1: string;
  let token1: string;
  let userId2: string;
  let _token2: string;

  beforeEach(async () => {
    projectRepo = new InMemoryProjectRepository();
    const routes = createProjectRoutes(projectRepo);
    app = new Hono();
    app.onError(errorHandler);
    app.route('/api/v1/projects', routes);

    userId1 = 'user_123';
    token1 = await signToken(userId1);

    userId2 = 'user_456';
    _token2 = await signToken(userId2);
  });

  describe('Authentication Enforcement', () => {
    it('should return 401 Unauthorized when requesting GET / without token', async () => {
      const res = await app.request('/api/v1/projects');
      expect(res.status).toBe(401);
    });

    it('should return 401 Unauthorized for invalid Bearer token', async () => {
      const res = await app.request('/api/v1/projects', {
        headers: { Authorization: 'Bearer invalid-token' },
      });
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/v1/projects', () => {
    it('should return empty list when user has no projects', async () => {
      const res = await app.request('/api/v1/projects', {
        headers: { Authorization: `Bearer ${token1}` },
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBe(0);
    });

    it('should return only projects belonging to authenticated user', async () => {
      await projectRepo.create({
        userId: userId1,
        name: 'Project 1',
        description: 'P1 desc',
        canvas: { nodes: [], edges: [] },
        isPublic: false,
      });

      await projectRepo.create({
        userId: userId2,
        name: 'Project 2',
        description: 'P2 desc',
        canvas: { nodes: [], edges: [] },
        isPublic: false,
      });

      const res = await app.request('/api/v1/projects', {
        headers: { Authorization: `Bearer ${token1}` },
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.length).toBe(1);
      expect(data[0].name).toBe('Project 1');
    });
  });

  describe('POST /api/v1/projects', () => {
    it('should create a project successfully with 201 status', async () => {
      const res = await app.request('/api/v1/projects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token1}`,
        },
        body: JSON.stringify({
          name: 'New Architecture',
          description: 'Microservices setup',
          canvas: { nodes: [{ id: '1' }], edges: [] },
          isPublic: true,
        }),
      });

      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.id).toBeDefined();
      expect(data.name).toBe('New Architecture');
      expect(data.userId).toBe(userId1);
      expect(data.isPublic).toBe(true);
    });

    it('should return 400 Bad Request if project name is missing', async () => {
      const res = await app.request('/api/v1/projects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token1}`,
        },
        body: JSON.stringify({
          name: '',
          canvas: { nodes: [], edges: [] },
        }),
      });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/v1/projects/:id', () => {
    it('should return user project by ID', async () => {
      const p = await projectRepo.create({
        userId: userId1,
        name: 'Private Project',
        description: null,
        canvas: { nodes: [], edges: [] },
        isPublic: false,
      });

      const res = await app.request(`/api/v1/projects/${p.id}`, {
        headers: { Authorization: `Bearer ${token1}` },
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.id).toBe(p.id);
      expect(data.name).toBe('Private Project');
    });

    it('should allow fetching a public project created by another user', async () => {
      const p = await projectRepo.create({
        userId: userId2,
        name: 'Public System Design',
        description: 'Shared design',
        canvas: { nodes: [], edges: [] },
        isPublic: true,
      });

      const res = await app.request(`/api/v1/projects/${p.id}`, {
        headers: { Authorization: `Bearer ${token1}` },
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.id).toBe(p.id);
    });

    it('should return 404 for private project of another user', async () => {
      const p = await projectRepo.create({
        userId: userId2,
        name: 'Secret System',
        description: null,
        canvas: { nodes: [], edges: [] },
        isPublic: false,
      });

      const res = await app.request(`/api/v1/projects/${p.id}`, {
        headers: { Authorization: `Bearer ${token1}` },
      });

      expect(res.status).toBe(404);
    });

    it('should return 404 for non-existent project ID', async () => {
      const res = await app.request('/api/v1/projects/nonexistent-id', {
        headers: { Authorization: `Bearer ${token1}` },
      });

      expect(res.status).toBe(404);
    });
  });

  describe('PUT /api/v1/projects/:id', () => {
    it('should update project fields by owner', async () => {
      const p = await projectRepo.create({
        userId: userId1,
        name: 'Old Name',
        description: 'Old Desc',
        canvas: { nodes: [], edges: [] },
        isPublic: false,
      });

      const res = await app.request(`/api/v1/projects/${p.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token1}`,
        },
        body: JSON.stringify({
          name: 'Updated Name',
          description: 'New Desc',
          isPublic: true,
        }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.name).toBe('Updated Name');
      expect(data.description).toBe('New Desc');
      expect(data.isPublic).toBe(true);
    });

    it('should return 404 when non-owner attempts to update project', async () => {
      const p = await projectRepo.create({
        userId: userId2,
        name: 'User 2 Project',
        description: null,
        canvas: { nodes: [], edges: [] },
        isPublic: true,
      });

      const res = await app.request(`/api/v1/projects/${p.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token1}`,
        },
        body: JSON.stringify({ name: 'Hacked Name' }),
      });

      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/v1/projects/:id', () => {
    it('should delete project successfully by owner', async () => {
      const p = await projectRepo.create({
        userId: userId1,
        name: 'To Delete',
        description: null,
        canvas: { nodes: [], edges: [] },
        isPublic: false,
      });

      const res = await app.request(`/api/v1/projects/${p.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token1}` },
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.message).toBe('Project deleted successfully');

      const found = await projectRepo.findById(p.id);
      expect(found).toBeNull();
    });

    it('should return 404 when non-owner attempts to delete project', async () => {
      const p = await projectRepo.create({
        userId: userId2,
        name: 'User 2 Project',
        description: null,
        canvas: { nodes: [], edges: [] },
        isPublic: false,
      });

      const res = await app.request(`/api/v1/projects/${p.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token1}` },
      });

      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/v1/projects/:id/clone', () => {
    it('should clone project successfully', async () => {
      const p = await projectRepo.create({
        userId: userId2,
        name: 'Template System',
        description: 'Template description',
        canvas: { nodes: [{ id: 'n1' }], edges: [] },
        isPublic: true,
      });

      const res = await app.request(`/api/v1/projects/${p.id}/clone`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token1}` },
      });

      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.id).not.toBe(p.id);
      expect(data.userId).toBe(userId1);
      expect(data.name).toBe('Template System (copy)');
      expect(data.isPublic).toBe(false);
    });

    it('should return 404 when attempting to clone private project of another user', async () => {
      const p = await projectRepo.create({
        userId: userId2,
        name: 'Private System',
        description: null,
        canvas: { nodes: [], edges: [] },
        isPublic: false,
      });

      const res = await app.request(`/api/v1/projects/${p.id}/clone`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token1}` },
      });

      expect(res.status).toBe(404);
    });
  });
});
