const isLocal = typeof window !== 'undefined' && (window.location?.hostname === 'localhost' || window.location?.hostname === '127.0.0.1');

const defaultBase = isLocal
  ? 'http://localhost:3000'
  : 'https://system-designapi-production.up.railway.app';

const rawBase = import.meta.env.VITE_API_URL || defaultBase;
const API_BASE = rawBase.replace(/\/$/, '');

class ApiClient {
  private token: string | null = null;

  setToken(token: string | null) {
    this.token = token;
    if (token) {
      localStorage.setItem('sds-auth-token', token);
    } else {
      localStorage.removeItem('sds-auth-token');
    }
  }

  getToken(): string | null {
    if (!this.token) {
      this.token = localStorage.getItem('sds-auth-token');
    }
    return this.token;
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const token = this.getToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...((options.headers as Record<string, string>) || {}),
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers,
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({ message: res.statusText }));
      const error = new Error(body.message || `API Error ${res.status}`) as Error & { status: number; body: unknown };
      error.status = res.status;
      error.body = body;
      throw error;
    }

    return res.json() as Promise<T>;
  }

  get<T>(path: string) { return this.request<T>(path, { method: 'GET' }); }
  post<T>(path: string, body?: unknown) { return this.request<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined }); }
  put<T>(path: string, body?: unknown) { return this.request<T>(path, { method: 'PUT', body: body ? JSON.stringify(body) : undefined }); }
  delete<T = void>(path: string) { return this.request<T>(path, { method: 'DELETE' }); }

  async checkHealth(): Promise<{ status: string; environment: string; engine?: string }> {
    return this.get('/api/health');
  }

  async sendTick<T>(input: { nodes: unknown[]; edges: unknown[]; tick: number; globalTrafficScale: number }): Promise<T> {
    return this.post<T>('/api/v1/simulation/tick', input);
  }
}

export const api = new ApiClient();
