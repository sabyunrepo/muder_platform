import { useMemo, useState, type DragEventHandler, type ReactNode } from 'react';
import { GripVertical, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import type { EditorThemeResponse, LocationResponse } from '@/features/editor/api';
import {
  buildLocationHierarchy,
  buildLocationMovePatch,
  getLocationPathLabel,
  validateLocationDrop,
} from '@/features/editor/entities/location/locationHierarchy';
import { readLocationClueIds } from '@/features/editor/editorTypes';

interface LocationHierarchyListProps {
  locations: LocationResponse[];
  theme: EditorThemeResponse;
  selectedId?: string | null;
  onSelect: (locationId: string) => void;
  onDelete: (location: LocationResponse) => void;
  onStartAddTopLevel: () => void;
  onStartAddChild: (parentId: string) => void;
  renderAddTopLevelInput: () => ReactNode;
  renderAddChildInput: (parentId: string) => ReactNode;
  onMoveLocation: (locationId: string, parentLocationId: string | null, sortOrder: number) => void;
}

export function LocationHierarchyList({
  locations,
  theme,
  selectedId,
  onSelect,
  onDelete,
  onStartAddTopLevel,
  onStartAddChild,
  renderAddTopLevelInput,
  renderAddChildInput,
  onMoveLocation,
}: LocationHierarchyListProps) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const clueCounts = useMemo(
    () =>
      Object.fromEntries(
        locations.map((location) => [
          location.id,
          readLocationClueIds(theme.config_json, location.id).length,
        ])
      ),
    [locations, theme.config_json]
  );
  const tree = useMemo(() => buildLocationHierarchy(locations, clueCounts), [locations, clueCounts]);

  function dropLocation(draggedId: string | null, targetParentId: string | null, targetIndex: number) {
    if (!draggedId) return;
    const validation = validateLocationDrop({ locations, draggedId, targetParentId });
    if (!validation.ok) {
      toast.error(dropErrorMessage(validation.reason));
      return;
    }
    const patch = buildLocationMovePatch({ locations, draggedId, targetParentId, targetIndex });
    onMoveLocation(draggedId, patch.parent_location_id, patch.sort_order);
  }

  return (
    <section
      aria-label="장소 목록"
      className="flex min-h-0 flex-col rounded-xl border border-slate-800 bg-slate-950/70 p-3"
    >
      <header className="mb-3 flex items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-slate-100">장소 목록</h3>
          <p className="text-xs text-slate-500">부모/하위 장소 모두 단서를 배치할 수 있습니다.</p>
        </div>
        <button
          type="button"
          onClick={onStartAddTopLevel}
          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-700 px-2.5 text-xs font-medium text-slate-300 transition hover:border-amber-500/50 hover:text-amber-100"
        >
          <Plus className="h-3.5 w-3.5" />
          장소 추가
        </button>
      </header>
      <div
        aria-label="최상위 장소 드롭 영역"
        onDragEnter={(event) => event.preventDefault()}
        onDragOver={(event) => {
          event.preventDefault();
          event.dataTransfer.dropEffect = 'move';
        }}
        onDrop={(event) => {
          event.preventDefault();
          const sourceId = draggingId || event.dataTransfer.getData('text/plain');
          dropLocation(sourceId, null, tree.length);
          setDraggingId(null);
        }}
        className="mb-3 rounded-md border border-dashed border-slate-800 px-3 py-2 text-xs text-slate-500"
      >
        최상위로 이동
      </div>
      {renderAddTopLevelInput()}

      {tree.length > 0 ? (
        <div className="space-y-3">
          {tree.map((node) => (
            <div key={node.location.id} className="space-y-2">
              <LocationCard
                location={node.location}
                label={node.location.name}
                directClueCount={node.directClueCount}
                childCount={node.children.length}
                selected={selectedId === node.location.id}
                draggable
                onSelect={() => onSelect(node.location.id)}
                onDelete={() => onDelete(node.location)}
                onDragStart={(event) => {
                  setDraggingId(node.location.id);
                  event.dataTransfer.effectAllowed = 'move';
                  event.dataTransfer.setData('text/plain', node.location.id);
                }}
                onDragEnd={() => setDraggingId(null)}
                onDrop={(event) => {
                  event.preventDefault();
                  const sourceId = draggingId || event.dataTransfer.getData('text/plain');
                  dropLocation(sourceId, node.location.id, node.children.length);
                  setDraggingId(null);
                }}
              />
              <button
                type="button"
                onClick={() => onStartAddChild(node.location.id)}
                aria-label={`${node.location.name} 하위장소 추가`}
                className="ml-2 inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-800 px-2.5 text-xs text-slate-400 transition hover:border-amber-500/50 hover:text-amber-100"
              >
                <Plus className="h-3.5 w-3.5" />
                하위 장소 추가
              </button>
              {renderAddChildInput(node.location.id)}
              {node.children.length > 0 ? (
                <div className="ml-5 space-y-2 border-l border-slate-800 pl-3">
                  {node.children.map((child) => (
                    <LocationCard
                      key={child.location.id}
                      location={child.location}
                      label={getLocationPathLabel(child.location, locations)}
                      directClueCount={child.directClueCount}
                      childCount={0}
                      selected={selectedId === child.location.id}
                      draggable
                      child
                      onSelect={() => onSelect(child.location.id)}
                      onDelete={() => onDelete(child.location)}
                      onDragStart={(event) => {
                        setDraggingId(child.location.id);
                        event.dataTransfer.effectAllowed = 'move';
                        event.dataTransfer.setData('text/plain', child.location.id);
                      }}
                      onDragEnd={() => setDraggingId(null)}
                      onDrop={(event) => {
                        event.preventDefault();
                        const sourceId = draggingId || event.dataTransfer.getData('text/plain');
                        dropLocation(sourceId, child.location.id, 0);
                        setDraggingId(null);
                      }}
                    />
                  ))}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      ) : (
        <p className="rounded-md border border-dashed border-slate-800 px-3 py-8 text-center text-xs text-slate-500">
          장소 없음
        </p>
      )}
    </section>
  );
}

function LocationCard({
  location,
  label,
  directClueCount,
  childCount,
  selected,
  child = false,
  draggable,
  onSelect,
  onDelete,
  onDragStart,
  onDragEnd,
  onDrop,
}: {
  location: LocationResponse;
  label: string;
  directClueCount: number;
  childCount: number;
  selected: boolean;
  child?: boolean;
  draggable: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onDragStart: DragEventHandler<HTMLDivElement>;
  onDragEnd: () => void;
  onDrop: DragEventHandler<HTMLDivElement>;
}) {
  return (
    <div
      aria-label={`${location.name} 드래그 영역`}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragEnter={(event) => event.preventDefault()}
      onDragOver={(event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
      }}
      onDrop={onDrop}
      className={`group rounded-lg border transition ${
        selected
          ? 'border-amber-400/60 bg-amber-500/10'
          : child
            ? 'border-slate-800 bg-slate-900/70 hover:border-slate-700'
            : 'border-slate-700 bg-slate-900 hover:border-amber-500/40'
      }`}
    >
      <div className="flex items-start gap-2 p-2.5">
        <GripVertical className="mt-1 h-3.5 w-3.5 shrink-0 text-slate-600" aria-hidden="true" />
        <button
          type="button"
          aria-label={`${label} 선택`}
          onClick={onSelect}
          className="min-w-0 flex-1 text-left"
        >
          <span className={`block truncate font-medium ${child ? 'text-sm' : 'text-base'} text-slate-100`}>
            {location.name}
          </span>
          <span className="mt-1 block text-xs text-slate-500">
            직접 배치 단서 {directClueCount}개 · 하위장소 {childCount}개
          </span>
        </button>
        <button
          type="button"
          onClick={onDelete}
          aria-label={`${location.name} 삭제`}
          className="rounded-md p-2 text-slate-600 transition hover:bg-red-950/40 hover:text-red-300"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

function dropErrorMessage(reason: string) {
  if (reason === 'grandchild') return '하위장소 아래에는 장소를 넣을 수 없습니다';
  if (reason === 'child-parent') return '하위장소가 있는 장소는 다른 장소 아래로 옮길 수 없습니다';
  if (reason === 'self') return '자기 자신 아래로 옮길 수 없습니다';
  return '장소 이동을 할 수 없습니다';
}
