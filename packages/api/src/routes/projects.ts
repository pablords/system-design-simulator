import { Hono } from 'hono';
import { z } from 'zod';
import { DrizzleProjectRepository, type IProjectRepository } from '../repositories/project.repository.js';
import { authMiddleware, getUserId } from '../middleware/auth.js';

const createProjectSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  description: z.string().max(1000).optional(),
  canvas: z.object({
    nodes: z.array(z.unknown()),
    edges: z.array(z.unknown()),
    viewport: z
      .object({
        x: z.number(),
        y: z.number(),
        zoom: z.number(),
      })
      .optional(),
  }),
  isPublic: z.boolean().optional().default(false),
});

const updateProjectSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).nullable().optional(),
  canvas: z
    .object({
      nodes: z.array(z.unknown()),
      edges: z.array(z.unknown()),
      viewport: z
        .object({
          x: z.number(),
          y: z.number(),
          zoom: z.number(),
        })
        .optional(),
    })
    .optional(),
  thumbnail: z.string().nullable().optional(),
  isPublic: z.boolean().optional(),
});

function formatDate(dateVal: Date | string): string {
  if (dateVal instanceof Date) {
    return dateVal.toISOString();
  }
  return new Date(dateVal).toISOString();
}

export function createProjectRoutes(customProjectRepo?: IProjectRepository) {
  const projectRepo = customProjectRepo || new DrizzleProjectRepository();
  const projectRoutes = new Hono();

  // All routes require authentication
  projectRoutes.use('/*', authMiddleware);

  // GET / — list user projects
  projectRoutes.get('/', async (c) => {
    const userId = getUserId(c);
    const userProjects = await projectRepo.findByUserId(userId);

    return c.json(
      userProjects.map((p) => ({
        ...p,
        createdAt: formatDate(p.createdAt),
        updatedAt: formatDate(p.updatedAt),
      }))
    );
  });

  // POST / — create project
  projectRoutes.post('/', async (c) => {
    const userId = getUserId(c);
    const body = createProjectSchema.parse(await c.req.json());

    const project = await projectRepo.create({
      userId,
      name: body.name,
      description: body.description ?? null,
      canvas: body.canvas,
      isPublic: body.isPublic,
    });

    return c.json(
      {
        ...project,
        createdAt: formatDate(project.createdAt),
        updatedAt: formatDate(project.updatedAt),
      },
      201
    );
  });

  // GET /:id — get project (owner or public)
  projectRoutes.get('/:id', async (c) => {
    const userId = getUserId(c);
    const projectId = c.req.param('id');

    const project = await projectRepo.findById(projectId);

    if (!project || (project.userId !== userId && !project.isPublic)) {
      return c.json({ error: 'NotFound', message: 'Project not found', statusCode: 404 }, 404);
    }

    return c.json({
      ...project,
      createdAt: formatDate(project.createdAt),
      updatedAt: formatDate(project.updatedAt),
    });
  });

  // PUT /:id — update project (owner only)
  projectRoutes.put('/:id', async (c) => {
    const userId = getUserId(c);
    const projectId = c.req.param('id');
    const body = updateProjectSchema.parse(await c.req.json());

    const existing = await projectRepo.findById(projectId);

    if (!existing || existing.userId !== userId) {
      return c.json({ error: 'NotFound', message: 'Project not found', statusCode: 404 }, 404);
    }

    const updated = await projectRepo.update(projectId, body);

    if (!updated) {
      return c.json({ error: 'NotFound', message: 'Project not found', statusCode: 404 }, 404);
    }

    return c.json({
      ...updated,
      createdAt: formatDate(updated.createdAt),
      updatedAt: formatDate(updated.updatedAt),
    });
  });

  // DELETE /:id — delete project (owner only)
  projectRoutes.delete('/:id', async (c) => {
    const userId = getUserId(c);
    const projectId = c.req.param('id');

    const deleted = await projectRepo.delete(projectId, userId);

    if (!deleted) {
      return c.json({ error: 'NotFound', message: 'Project not found', statusCode: 404 }, 404);
    }

    return c.json({ message: 'Project deleted successfully' });
  });

  // POST /:id/clone — clone project (owner or public)
  projectRoutes.post('/:id/clone', async (c) => {
    const userId = getUserId(c);
    const projectId = c.req.param('id');

    const source = await projectRepo.findById(projectId);

    if (!source || (source.userId !== userId && !source.isPublic)) {
      return c.json({ error: 'NotFound', message: 'Project not found', statusCode: 404 }, 404);
    }

    const cloned = await projectRepo.create({
      userId,
      name: `${source.name} (copy)`,
      description: source.description,
      canvas: source.canvas,
      isPublic: false,
    });

    return c.json(
      {
        ...cloned,
        createdAt: formatDate(cloned.createdAt),
        updatedAt: formatDate(cloned.updatedAt),
      },
      201
    );
  });

  return projectRoutes;
}

export const projectRoutes = createProjectRoutes();
