import { useCallback, useRef, useEffect } from 'react';
import { X } from 'lucide-react';
import { useWorkspaceStore } from '../stores/workspaceStore';
import { usePipelineStore } from '../stores/pipelineStore';
import { TaskInspector } from './mission-control/TaskInspector';

/**
 * Forensic Inspector — the right-side evidence panel.
 * When a task is selected, renders deep forensic layers:
 * verdict summary, vector fingerprint, semantic diff, response, and raw payload.
 */
export function Inspector() {
  const {
    inspectorOpen,
    inspectorWidth,
    selectedEntity,
    closeInspector,
    setInspectorWidth,
    openPromptDiff,
  } = useWorkspaceStore();

  const liveTasks = usePipelineStore((s) => s.liveTasks);

  const dragRef = useRef<{ startX: number; startW: number } | null>(null);

  // Escape closes the inspector
  useEffect(() => {
    if (!inspectorOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        closeInspector();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [inspectorOpen, closeInspector]);

  // Drag-to-resize
  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      dragRef.current = { startX: e.clientX, startW: inspectorWidth };
      const onMouseMove = (ev: MouseEvent) => {
        if (!dragRef.current) return;
        const delta = dragRef.current.startX - ev.clientX;
        setInspectorWidth(dragRef.current.startW + delta);
      };
      const onMouseUp = () => {
        dragRef.current = null;
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    },
    [inspectorWidth, setInspectorWidth]
  );

  if (!inspectorOpen) return null;

  const selectedTask =
    selectedEntity?.type === 'task' && selectedEntity.id
      ? liveTasks[selectedEntity.id] || null
      : null;

  return (
    <>
      <aside
        className="relative shrink-0 h-full bg-ivory border-l border-hairline flex flex-col overflow-hidden shadow-2xl z-40"
        style={{ width: inspectorWidth }}
        role="complementary"
        aria-label="Evidence inspector"
      >
        {/* Resize handle */}
        <div
          className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-hairline/80 active:bg-cream z-10 transition-colors"
          onMouseDown={onMouseDown}
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize inspector"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'ArrowLeft') {
              e.preventDefault();
              setInspectorWidth(inspectorWidth + 20);
            } else if (e.key === 'ArrowRight') {
              e.preventDefault();
              setInspectorWidth(inspectorWidth - 20);
            }
          }}
        />

        {/* Specimen header bar */}
        <div className="flex items-center justify-between px-4 py-3 bg-linen/40 border-b border-hairline shrink-0 select-none">
          <div className="min-w-0">
            {selectedEntity ? (
              <>
                <p className="font-mono text-[10px] font-bold text-steel tracking-wider uppercase">
                  {selectedEntity.type.toUpperCase()} EVIDENCE DOSSIER
                </p>
                <p className="text-xs text-slate font-mono font-semibold truncate mt-0.5" title={selectedEntity.id}>
                  {selectedEntity.id}
                </p>
              </>
            ) : (
              <p className="text-xs text-taupe font-mono">No entity selected</p>
            )}
          </div>
          <button
            onClick={closeInspector}
            className="p-1 rounded-xs text-steel hover:text-slate hover:bg-linen transition-colors cursor-pointer"
            aria-label="Close inspector"
          >
            <X className="w-4 h-4" strokeWidth={2} />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {selectedTask ? (
            <TaskInspector
              task={selectedTask}
              onOpenDeepDiff={() =>
                openPromptDiff(selectedTask.run_id || 'all', selectedTask.task_id)
              }
            />
          ) : selectedEntity ? (
            <div className="p-6 text-center font-mono">
              <p className="text-xs text-steel uppercase font-bold">{selectedEntity.type} SPECIMEN</p>
              <p className="text-[11px] text-taupe mt-1 break-all">{selectedEntity.id}</p>
              <p className="text-xs text-steel mt-4">
                Telemetry and finding evidence details are loaded dynamically from the live event bus.
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full py-16 text-center px-4 font-mono">
              <p className="text-xs text-steel uppercase font-semibold">
                SELECT A TASK SPECIMEN TO INSPECT EVIDENCE
              </p>
              <p className="text-[11px] text-taupe mt-1">NO ACTIVE SELECTION</p>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}

