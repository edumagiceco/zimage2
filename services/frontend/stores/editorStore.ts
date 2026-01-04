import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface BrushPreset {
  id: string;
  name: string;
  size: number;
  hardness: number;
  isDefault?: boolean;
}

interface EditorState {
  // Brush presets
  presets: BrushPreset[];
  activePresetId: string | null;

  // Mask refinement settings
  refinementRadius: number;

  // Actions
  addPreset: (name: string, size: number, hardness: number) => void;
  deletePreset: (id: string) => void;
  updatePreset: (id: string, name: string) => void;
  setActivePreset: (id: string | null) => void;
  getPresetById: (id: string) => BrushPreset | undefined;
  setRefinementRadius: (radius: number) => void;
  resetToDefaults: () => void;
}

// 기본 프리셋
const DEFAULT_PRESETS: BrushPreset[] = [
  { id: 'default-soft', name: '부드러운 브러시', size: 40, hardness: 20, isDefault: true },
  { id: 'default-normal', name: '기본 브러시', size: 30, hardness: 80, isDefault: true },
  { id: 'default-hard', name: '딱딱한 브러시', size: 25, hardness: 100, isDefault: true },
  { id: 'default-detail', name: '세밀 작업', size: 15, hardness: 100, isDefault: true },
];

export const useEditorStore = create<EditorState>()(
  persist(
    (set, get) => ({
      presets: DEFAULT_PRESETS,
      activePresetId: null,
      refinementRadius: 5,

      addPreset: (name, size, hardness) => {
        const newPreset: BrushPreset = {
          id: `preset-${Date.now()}`,
          name,
          size,
          hardness,
          isDefault: false,
        };
        set((state) => ({
          presets: [...state.presets, newPreset],
          activePresetId: newPreset.id,
        }));
      },

      deletePreset: (id) => {
        set((state) => ({
          presets: state.presets.filter((p) => p.id !== id),
          activePresetId: state.activePresetId === id ? null : state.activePresetId,
        }));
      },

      updatePreset: (id, name) => {
        set((state) => ({
          presets: state.presets.map((p) =>
            p.id === id ? { ...p, name } : p
          ),
        }));
      },

      setActivePreset: (id) => {
        set({ activePresetId: id });
      },

      getPresetById: (id) => {
        return get().presets.find((p) => p.id === id);
      },

      setRefinementRadius: (radius) => {
        set({ refinementRadius: radius });
      },

      resetToDefaults: () => {
        set({
          presets: DEFAULT_PRESETS,
          activePresetId: null,
          refinementRadius: 5,
        });
      },
    }),
    {
      name: 'editor-storage',
      partialize: (state) => ({
        presets: state.presets,
        refinementRadius: state.refinementRadius,
      }),
    }
  )
);
