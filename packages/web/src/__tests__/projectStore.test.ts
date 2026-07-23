import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { useProjectStore } from '../store/projectStore';
import { api } from '../api/client';

describe('projectStore', () => {
  beforeEach(() => {
    useProjectStore.setState({
      projects: [],
      currentProjectId: null,
      currentProjectName: 'Untitled Project',
      saveStatus: 'idle',
      isLoadingProjects: false,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Initial State', () => {
    it('should have initial default values', () => {
      const state = useProjectStore.getState();
      expect(state.projects).toEqual([]);
      expect(state.currentProjectId).toBeNull();
      expect(state.currentProjectName).toBe('Untitled Project');
      expect(state.saveStatus).toBe('idle');
      expect(state.isLoadingProjects).toBe(false);
    });
  });

  describe('Projects Fetching', () => {
    it('should fetch project list successfully', async () => {
      const mockProjects = [
        {
          id: 'proj-1',
          name: 'Microservices Architecture',
          description: 'E-commerce platform',
          thumbnail: null,
          isPublic: true,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ];

      const apiGetSpy = vi.spyOn(api, 'get').mockResolvedValue(mockProjects);

      await useProjectStore.getState().fetchProjects();

      expect(apiGetSpy).toHaveBeenCalledWith('/api/v1/projects');
      const state = useProjectStore.getState();
      expect(state.projects).toEqual(mockProjects);
      expect(state.isLoadingProjects).toBe(false);
    });

    it('should handle project fetch errors gracefully', async () => {
      vi.spyOn(api, 'get').mockRejectedValue(new Error('Network error'));

      await useProjectStore.getState().fetchProjects();

      const state = useProjectStore.getState();
      expect(state.projects).toEqual([]);
      expect(state.isLoadingProjects).toBe(false);
    });
  });

  describe('Projects CRUD Operations', () => {
    it('should create new project and set as current project', async () => {
      const newProject = {
        id: 'proj-new',
        userId: 'user-1',
        name: 'New Architecture',
        description: null,
        thumbnail: null,
        isPublic: false,
        canvas: { nodes: [], edges: [] },
        createdAt: '2026-07-23T00:00:00.000Z',
        updatedAt: '2026-07-23T00:00:00.000Z',
      };

      const apiPostSpy = vi.spyOn(api, 'post').mockResolvedValue(newProject);

      const createdId = await useProjectStore.getState().createProject('New Architecture', { nodes: [], edges: [] });

      expect(apiPostSpy).toHaveBeenCalledWith('/api/v1/projects', {
        name: 'New Architecture',
        canvas: { nodes: [], edges: [] },
      });
      expect(createdId).toBe('proj-new');

      const state = useProjectStore.getState();
      expect(state.currentProjectId).toBe('proj-new');
      expect(state.currentProjectName).toBe('New Architecture');
      expect(state.projects.length).toBe(1);
    });

    it('should load single project by ID', async () => {
      const loadedProject = {
        id: 'proj-loaded',
        userId: 'user-1',
        name: 'Loaded System Design',
        description: 'Detail',
        thumbnail: null,
        isPublic: false,
        canvas: { nodes: [{ id: 'n1' }], edges: [] },
        createdAt: '2026-07-23T00:00:00.000Z',
        updatedAt: '2026-07-23T00:00:00.000Z',
      };

      const apiGetSpy = vi.spyOn(api, 'get').mockResolvedValue(loadedProject);

      const result = await useProjectStore.getState().loadProject('proj-loaded');

      expect(apiGetSpy).toHaveBeenCalledWith('/api/v1/projects/proj-loaded');
      expect(result).toEqual(loadedProject);

      const state = useProjectStore.getState();
      expect(state.currentProjectId).toBe('proj-loaded');
      expect(state.currentProjectName).toBe('Loaded System Design');
    });

    it('should delete project and reset currentProjectId if deleted project was selected', async () => {
      useProjectStore.setState({
        projects: [
          { id: 'p1', name: 'P1', description: null, thumbnail: null, isPublic: true, createdAt: '', updatedAt: '' },
          { id: 'p2', name: 'P2', description: null, thumbnail: null, isPublic: true, createdAt: '', updatedAt: '' },
        ],
        currentProjectId: 'p1',
      });

      const apiDeleteSpy = vi.spyOn(api, 'delete').mockResolvedValue({});

      await useProjectStore.getState().deleteProject('p1');

      expect(apiDeleteSpy).toHaveBeenCalledWith('/api/v1/projects/p1');
      const state = useProjectStore.getState();
      expect(state.projects.length).toBe(1);
      expect(state.projects[0].id).toBe('p2');
      expect(state.currentProjectId).toBeNull();
    });

    it('should clone project', async () => {
      const clonedProject = {
        id: 'proj-clone',
        userId: 'user-1',
        name: 'P1 (Copy)',
        description: null,
        thumbnail: null,
        isPublic: false,
        canvas: { nodes: [], edges: [] },
        createdAt: '2026-07-23T00:00:00.000Z',
        updatedAt: '2026-07-23T00:00:00.000Z',
      };

      const apiPostSpy = vi.spyOn(api, 'post').mockResolvedValue(clonedProject);

      const cloneId = await useProjectStore.getState().cloneProject('proj-1');

      expect(apiPostSpy).toHaveBeenCalledWith('/api/v1/projects/proj-1/clone');
      expect(cloneId).toBe('proj-clone');

      const state = useProjectStore.getState();
      expect(state.projects[0].id).toBe('proj-clone');
    });
  });

  describe('Auto-Save State Transitions', () => {
    it('should transition saveStatus through saving and saved on success', async () => {
      const apiPutSpy = vi.spyOn(api, 'put').mockResolvedValue({});

      const savePromise = useProjectStore.getState().saveProject('p1', { name: 'Updated Name' });

      expect(useProjectStore.getState().saveStatus).toBe('saving');

      await savePromise;

      expect(apiPutSpy).toHaveBeenCalledWith('/api/v1/projects/p1', { name: 'Updated Name' });
      expect(useProjectStore.getState().saveStatus).toBe('saved');
    });

    it('should transition saveStatus to error on put failure', async () => {
      vi.spyOn(api, 'put').mockRejectedValue(new Error('Save failed'));

      await useProjectStore.getState().saveProject('p1', { name: 'Updated Name' });

      expect(useProjectStore.getState().saveStatus).toBe('error');
    });
  });

  describe('Setters', () => {
    it('should update current project metadata', () => {
      useProjectStore.getState().setCurrentProject('p99', 'Custom Project');
      const state = useProjectStore.getState();
      expect(state.currentProjectId).toBe('p99');
      expect(state.currentProjectName).toBe('Custom Project');
    });

    it('should update save status manually', () => {
      useProjectStore.getState().setSaveStatus('saving');
      expect(useProjectStore.getState().saveStatus).toBe('saving');
    });
  });
});
