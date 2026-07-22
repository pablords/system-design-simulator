import { Hono } from 'hono';
import { z } from 'zod';
import { eq, and, or, desc } from 'drizzle-orm';
import { db } from '../db/index.js';
import { schema } from '../db/index.js';
import { authMiddleware, getUserId } from '../middleware/auth.js';

const createProjectSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  description: z.string().max(1000).optional(),
  canvas: z.object({
    nodes: z.array(z.unknown()),
    edges: z.array(z.unknown()),
    viewport: z.object({
      x: z.number(),
      y: z.number(),
      zoom: z.number(),
    }).optional(),
  }),
  isPublic: z.boolean().optional().default(false),
});

const updateProjectSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).nullable().optional(),
  canvas: z.object({
    nodes: z.array(z.unknown()),
    edges: z.array(z.unknown()),
    viewport: z.object({
      x: z.number(),
      y: z.number(),
      zoom: z.number(),
    }).optional(),
  }).optional(),
  thumbnail: z.string().nullable().optional(),
  isPublic: z.boolean().optional(),
});

export const projectRoutes = new Hono();

// All routes require authentication
projectRoutes.use('/*', authMiddleware);

// GET / — list user projects
projectRoutes.get('/', async (c) => {
  const userId = getUserId(c);

  const userProjects = await db
    .select({
      id: schema.projects.id,
      name: schema.projects.name,
      description: schema.projects.description,
      thumbnail: schema.projects.thumbnail,
      isPublic: schema.projects.isPublic,
      createdAt: schema.projects.createdAt,
      updatedAt: schema.projects.updatedAt,
    })
    .from(schema.projects)
    .where(eq(schema.projects.userId, userId))
    .orderBy(desc(schema.projects.updatedAt));

  return c.json(
    userProjects.map((p) => ({
      ...p,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
    }))
  );
});

// POST / — create project
projectRoutes.post('/', async (c) => {
  const userId = getUserId(c);
  const body = createProjectSchema.parse(await c.req.json());

  const [project] = await db
    .insert(schema.projects)
    .values({
      userId,
      name: body.name,
      description: body.description ?? null,
      canvas: body.canvas,
      isPublic: body.isPublic,
    })
    .returning();

  return c.json(
    {
      ...project,
      createdAt: project.createdAt.toISOString(),
      updatedAt: project.updatedAt.toISOString(),
    },
    201
  );
});

// GET /:id — get project (owner or public)
projectRoutes.get('/:id', async (c) => {
  const userId = getUserId(c);
  const projectId = c.req.param('id');

  const [project] = await db
    .select()
    .from(schema.projects)
    .where(
      and(
        eq(schema.projects.id, projectId),
        or(
          eq(schema.projects.userId, userId),
          eq(schema.projects.isPublic, true)
        )
      )
    )
    .limit(1);

  if (!project) {
    return c.json({ error: 'NotFound', message: 'Project not found', statusCode: 404 }, 404);
  }

  return c.json({
    ...project,
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
  });
});

// PUT /:id — update project (owner only)
projectRoutes.put('/:id', async (c) => {
  const userId = getUserId(c);
  const projectId = c.req.param('id');
  const body = updateProjectSchema.parse(await c.req.json());

  // Verify ownership
  const [existing] = await db
    .select({ id: schema.projects.id })
    .from(schema.projects)
    .where(and(eq(schema.projects.id, projectId), eq(schema.projects.userId, userId)))
    .limit(1);

  if (!existing) {
    return c.json({ error: 'NotFound', message: 'Project not found', statusCode: 404 }, 404);
  }

  const [updated] = await db
    .update(schema.projects)
    .set({
      ...body,
      updatedAt: new Date(),
    })
    .where(eq(schema.projects.id, projectId))
    .returning();

  return c.json({
    ...updated,
    createdAt: updated.createdAt.toISOString(),
    updatedAt: updated.updatedAt.toISOString(),
  });
});

// DELETE /:id — delete project (owner only)
projectRoutes.delete('/:id', async (c) => {
  const userId = getUserId(c);
  const projectId = c.req.param('id');

  const [deleted] = await db
    .delete(schema.projects)
    .where(and(eq(schema.projects.id, projectId), eq(schema.projects.userId, userId)))
    .returning({ id: schema.projects.id });

  if (!deleted) {
    return c.json({ error: 'NotFound', message: 'Project not found', statusCode: 404 }, 404);
  }

  return c.json({ message: 'Project deleted successfully' });
});

// POST /:id/clone — clone project (owner or public)
projectRoutes.post('/:id/clone', async (c) => {
  const userId = getUserId(c);
  const projectId = c.req.param('id');

  const [source] = await db
    .select()
    .from(schema.projects)
    .where(
      and(
        eq(schema.projects.id, projectId),
        or(
          eq(schema.projects.userId, userId),
          eq(schema.projects.isPublic, true)
        )
      )
    )
    .limit(1);

  if (!source) {
    return c.json({ error: 'NotFound', message: 'Project not found', statusCode: 404 }, 404);
  }

  const [cloned] = await db
    .insert(schema.projects)
    .values({
      userId,
      name: `${source.name} (copy)`,
      description: source.description,
      canvas: source.canvas,
      isPublic: false,
    })
    .returning();

  return c.json(
    {
      ...cloned,
      createdAt: cloned.createdAt.toISOString(),
      updatedAt: cloned.updatedAt.toISOString(),
    },
    201
  );
});
