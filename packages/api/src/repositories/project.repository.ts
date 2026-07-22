export interface ProjectEntity {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  canvas: Record<string, any>;
  isPublic: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IProjectRepository {
  findByUserId(userId: string): Promise<ProjectEntity[]>;
  findById(id: string): Promise<ProjectEntity | null>;
  create(project: Omit<ProjectEntity, 'id' | 'createdAt' | 'updatedAt'>): Promise<ProjectEntity>;
  update(id: string, updateData: Partial<Omit<ProjectEntity, 'id' | 'userId' | 'createdAt'>>): Promise<ProjectEntity | null>;
  delete(id: string, userId: string): Promise<boolean>;
}

export class InMemoryProjectRepository implements IProjectRepository {
  private projects: ProjectEntity[] = [];

  async findByUserId(userId: string): Promise<ProjectEntity[]> {
    return this.projects.filter((p) => p.userId === userId);
  }

  async findById(id: string): Promise<ProjectEntity | null> {
    return this.projects.find((p) => p.id === id) || null;
  }

  async create(project: Omit<ProjectEntity, 'id' | 'createdAt' | 'updatedAt'>): Promise<ProjectEntity> {
    const newProject: ProjectEntity = {
      ...project,
      id: `proj_${Math.random().toString(36).substring(2, 9)}`,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.projects.push(newProject);
    return newProject;
  }

  async update(id: string, updateData: Partial<Omit<ProjectEntity, 'id' | 'userId' | 'createdAt'>>): Promise<ProjectEntity | null> {
    const index = this.projects.findIndex((p) => p.id === id);
    if (index === -1) return null;

    this.projects[index] = {
      ...this.projects[index],
      ...updateData,
      updatedAt: new Date(),
    };
    return this.projects[index];
  }

  async delete(id: string, userId: string): Promise<boolean> {
    const index = this.projects.findIndex((p) => p.id === id && p.userId === userId);
    if (index === -1) return false;
    this.projects.splice(index, 1);
    return true;
  }
}
