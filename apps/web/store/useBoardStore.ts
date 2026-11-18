import { create } from 'zustand';
import { Card, Column } from '@fake-trello/shared';

export interface PendingSocketEvent {
  event: string;
  data: any;
  timestamp: number;
}

interface BoardStore {
  activeCard: Card | null;
  activeColumn: Column | null;
  isDragging: boolean;
  dragSourceColumnId: string | null;
  dragSourceCardId: string | null;
  dragTargetColumnId: string | null;
  dragTargetCardId: string | null;
  dragOverColumnId: string | null;
  pendingSocketEvents: PendingSocketEvent[];
  
  setActiveCard: (card: Card | null) => void;
  setActiveColumn: (column: Column | null) => void;
  setIsDragging: (isDragging: boolean) => void;
  setDragSource: (sourceColumnId: string | null, sourceCardId: string | null) => void;
  setDragTarget: (targetColumnId: string | null, targetCardId: string | null) => void;
  setDragOverColumn: (columnId: string | null) => void;
  addPendingSocketEvent: (event: string, data: any) => void;
  clearPendingSocketEvents: () => void;
  processPendingSocketEvents: () => void;
  resetDragState: () => void;
}

export const useBoardStore = create<BoardStore>((set, get) => ({
  activeCard: null,
  activeColumn: null,
  isDragging: false,
  dragSourceColumnId: null,
  dragSourceCardId: null,
  dragTargetColumnId: null,
  dragTargetCardId: null,
  dragOverColumnId: null,
  pendingSocketEvents: [],
  
  setActiveCard: (card) => set({ activeCard: card }),
  setActiveColumn: (column) => set({ activeColumn: column }),
  setIsDragging: (isDragging) => set({ isDragging }),
  setDragSource: (sourceColumnId, sourceCardId) => 
    set({ 
      dragSourceColumnId: sourceColumnId,
      dragSourceCardId: sourceCardId,
    }),
  setDragTarget: (targetColumnId, targetCardId) => 
    set({ 
      dragTargetColumnId: targetColumnId,
      dragTargetCardId: targetCardId,
    }),
  setDragOverColumn: (columnId) => set({ dragOverColumnId: columnId }),
  
  addPendingSocketEvent: (event, data) => 
    set((state) => ({
      pendingSocketEvents: [...state.pendingSocketEvents, { event, data, timestamp: Date.now() }],
    })),
  
  clearPendingSocketEvents: () => set({ pendingSocketEvents: [] }),
  
  processPendingSocketEvents: () => {
    const { pendingSocketEvents } = get();
    pendingSocketEvents.forEach(({ event, data }) => {
      if (typeof window !== 'undefined' && (window as any).socket) {
        const socket = (window as any).socket;
        socket.emit(event, data);
      }
    });
    set({ pendingSocketEvents: [] });
  },
  
  resetDragState: () => 
    set({ 
      activeCard: null,
      activeColumn: null,
      isDragging: false,
      dragSourceColumnId: null,
      dragSourceCardId: null,
      dragTargetColumnId: null,
      dragTargetCardId: null,
      dragOverColumnId: null,
    }),
}));

export default useBoardStore;