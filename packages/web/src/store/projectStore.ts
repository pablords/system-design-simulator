import { create } from 'zustand';
import { api } from '../api/client';

interface ProjectListItem {
  id: string;
  name: string;
  description: string | null;
  thumbnail: string | null;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
}

interface ProjectFull extends ProjectListItem {
  userId: string;
  canvas: {
    nodes: unknown[];
    edges: unknown[];
    viewport?: { x: number; y: number; zoom: number };
  };
}

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

interface ProjectState {
  projects: ProjectListItem[];
  currentProjectId: string | null;
  currentProjectName: string;
  saveStatus: SaveStatus;
  isLoadingProjects: boolean;

  fetchProjects: () => Promise<void>;
  createProject: (name: string, canvas: { nodes: unknown[]; edges: unknown[] }) => Promise<string>;
  loadProject: (id: string) => Promise<ProjectFull>;
  saveProject: (id: string, data: { name?: string; canvas?: { nodes: unknown[]; edges: unknown[] } }) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  cloneProject: (id: string) => Promise<string>;
  setCurrentProject: (id: string | null, name?: string) => void;
  setSaveStatus: (status: SaveStatus) => void;
}

export const useProjectStore = create<ProjectState>()((set, get) => ({
  projects: [],
  currentProjectId: null,
  currentProjectName: 'Untitled Project',
  saveStatus: 'idle',
  isLoadingProjects: false,

  fetchProjects: async () => {
    set({ isLoadingProjects: true });
    try {
      const projects = await api.get<ProjectListItem[]>('/api/v1/projects');
      set({ projects, isLoadingProjects: false });
    } catch {
      set({ isLoadingProjects: false });
    }
  },

  createProject: async (name, canvas) => {
    const project = await api.post<ProjectFull>('/api/v1/projects', { name, canvas });
    set((state) => ({
      projects: [{
        id: project.id,
        name: project.name,
        description: project.description,
        thumbnail: project.thumbnail,
        isPublic: project.isPublic,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
      }, ...state.projects],
      currentProjectId: project.id,
      currentProjectName: project.name,
    }));
    return project.id;
  },

  loadProject: async (id) => {
    const project = await api.get<ProjectFull>(`/api/v1/projects/${id}`);
    set({ currentProjectId: project.id, currentProjectName: project.name });
    return project;
  },

  saveProject: async (id, data) => {
    set({ saveStatus: 'saving' });
    try {
      await api.put(`/api/v1/projects/${id}`, data);
      set({ saveStatus: 'saved' });
      setTimeout(() => {
        if (get().saveStatus === 'saved') set({ saveStatus: 'idle' });
      }, 2000);
    } catch {
      set({ saveStatus: 'error' });
    }
  },

  deleteProject: async (id) => {
    await api.delete(`/api/v1/projects/${id}`);
    set((state) => ({
      projects: state.projects.filter((p) => p.id !== id),
      currentProjectId: state.currentProjectId === id ? null : state.currentProjectId,
    }));
  },

  cloneProject: async (id) => {
    const project = await api.post<ProjectFull>(`/api/v1/projects/${id}/clone`);
    set((state) => ({
      projects: [{
        id: project.id,
        name: project.name,
        description: project.description,
        thumbnail: project.thumbnail,
        isPublic: project.isPublic,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
      }, ...state.projects],
    }));
    return project.id;
  },

  setCurrentProject: (id, name) => set({ currentProjectId: id, currentProjectName: name || 'Untitled Project' }),
  setSaveStatus: (status) => set({ saveStatus: status }),
}));
