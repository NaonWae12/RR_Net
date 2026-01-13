// Mock service for Tempo Templates (localStorage-backed, until BE API ready)

export interface TempoTemplate {
  id: string;
  name: string;
  day: number; // 1-31
  description?: string | null;
  created_at?: string;
  updated_at?: string;
}

const STORAGE_KEY = 'rrnet_tempo_templates';

export const tempoTemplateService = {
  list(): TempoTemplate[] {
    if (typeof window === 'undefined') return [];
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return [];
      return JSON.parse(stored) as TempoTemplate[];
    } catch {
      return [];
    }
  },

  create(template: Omit<TempoTemplate, 'id' | 'created_at' | 'updated_at'>): TempoTemplate {
    const templates = this.list();
    const now = new Date().toISOString();
    const newTemplate: TempoTemplate = {
      ...template,
      id: `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      created_at: now,
      updated_at: now,
    };
    templates.push(newTemplate);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
    return newTemplate;
  },

  update(id: string, updates: Partial<Omit<TempoTemplate, 'id' | 'created_at'>>): TempoTemplate {
    const templates = this.list();
    const index = templates.findIndex((t) => t.id === id);
    if (index === -1) throw new Error('Template not found');
    const updated: TempoTemplate = {
      ...templates[index],
      ...updates,
      updated_at: new Date().toISOString(),
    };
    templates[index] = updated;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
    return updated;
  },

  delete(id: string): void {
    const templates = this.list();
    const filtered = templates.filter((t) => t.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  },
};

