import { useMemo, useState } from 'react';
import { Plus, Search, Trash2 } from 'lucide-react';
import { useEditorCharacters, type EditorThemeResponse } from '@/features/editor/api';
import { useFlowData } from '../../hooks/useFlowData';
import type { FlowNodeData } from '../../flowTypes';
import { EndingEntityDetail } from './EndingEntityDetail';
import { EndingDecisionSummaryPanel } from './EndingDecisionSummaryPanel';
import { EndingEmptyState } from './EndingEmptyState';
import { EndingEntityHeader } from './EndingEntityHeader';
import { EndingBranchRulesPanel } from './EndingBranchRulesPanel';
import {
  buildEndingDecisionSummary,
  toEndingEditorViewModel,
} from '../../entities/ending/endingEntityAdapter';
import { readEndingBranchConfig } from '../../entities/ending/endingBranchAdapter';
import { getDisplayErrorMessage } from '@/lib/display-error';
import { editorDesignClassNames } from '@/features/editor/design-system/editorDesignTokens';

interface EndingEntitySubTabProps {
  themeId: string;
  theme: EditorThemeResponse;
}

export function EndingEntitySubTab({ themeId, theme }: EndingEntitySubTabProps) {
  return <EndingEntityWorkspace themeId={themeId} theme={theme} section="endings" />;
}

export function EndingQuestionsTab({ themeId, theme }: EndingEntitySubTabProps) {
  return <EndingEntityWorkspace themeId={themeId} theme={theme} section="questions" />;
}

function EndingEntityWorkspace({
  themeId,
  theme,
  section,
}: EndingEntitySubTabProps & { section: 'questions' | 'endings' }) {
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { data: characters = [] } = useEditorCharacters(themeId);
  const {
    nodes,
    edges = [],
    isLoading,
    isError,
    error,
    refetch,
    addNode,
    deleteNode,
    updateNodeData,
  } = useFlowData(themeId);

  const endingNodes = useMemo(() => nodes.filter((node) => node.type === 'ending'), [nodes]);
  const endingBranchConfig = useMemo(
    () => readEndingBranchConfig(theme.config_json),
    [theme.config_json],
  );
  const conditionGroupCountByEnding = useMemo(() => {
    const counts = new Map<string, number>();
    for (const row of endingBranchConfig.matrix) {
      if (!row.ending) continue;
      counts.set(row.ending, (counts.get(row.ending) ?? 0) + 1);
    }
    return counts;
  }, [endingBranchConfig.matrix]);

  const filteredNodes = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return endingNodes;
    return endingNodes.filter((node) => {
      const data = node.data as FlowNodeData;
      return [data.label, data.description, data.endingContent]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle));
    });
  }, [endingNodes, query]);

  const selectedNode =
    filteredNodes.find((node) => node.id === selectedId) ?? filteredNodes[0] ?? null;

  const decisionSummary = useMemo(() => buildEndingDecisionSummary(nodes, edges), [nodes, edges]);

  const handleAddEnding = () => {
    addNode(
      'ending',
      { x: 360 + endingNodes.length * 40, y: 220 },
      undefined,
      { onCreated: (node) => setSelectedId(node.id) },
    );
  };

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-sm text-[var(--mmp-editor-color-slate)]">
        결말 목록을 불러오는 중입니다...
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-center">
        <div className={`max-w-md p-6 ${editorDesignClassNames.errorPanel}`}>
          <h3 className="text-lg font-semibold">결말 목록을 불러오지 못했습니다</h3>
          <p className="mt-2 text-sm leading-6">
            네트워크나 권한 문제일 수 있습니다. 잠시 후 다시 시도해 주세요.
          </p>
          <p className="mt-3 rounded-md bg-[var(--mmp-editor-color-canvas)] p-3 text-left text-xs leading-5">
            {getDisplayErrorMessage(error, '결말 목록을 불러오지 못했습니다.')}
          </p>
          <button
            type="button"
            onClick={() => void refetch()}
            className={`mt-4 inline-flex min-h-11 items-center justify-center px-4 ${editorDesignClassNames.secondaryAction}`}
          >
            다시 불러오기
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      data-testid="ending-entity-panel"
      className={`flex h-full min-h-0 flex-col gap-4 overflow-y-auto p-4 lg:p-6 ${editorDesignClassNames.surface}`}
    >
      {section === 'endings' ? <EndingEntityHeader /> : null}

      {section === 'endings' ? <EndingDecisionSummaryPanel summary={decisionSummary} /> : null}

      {section === 'endings' ? (
        <EndingBranchRulesPanel
          themeId={themeId}
          theme={theme}
          endingNodes={endingNodes}
          characters={characters}
          section={section}
          settingsOnly
        />
      ) : null}

      {section === 'questions' ? (
        <EndingBranchRulesPanel
          themeId={themeId}
          theme={theme}
          endingNodes={endingNodes}
          characters={characters}
          section={section}
        />
      ) : null}

      {section !== 'endings' ? null : endingNodes.length === 0 ? (
        <EndingEmptyState />
      ) : (
        <div className="grid items-start gap-4 lg:grid-cols-[minmax(220px,320px)_minmax(0,1fr)]">
          <aside className={`flex min-w-0 flex-col gap-3 p-3 ${editorDesignClassNames.panel}`}>
            <button
              type="button"
              onClick={handleAddEnding}
              className={`inline-flex min-h-11 items-center justify-center gap-2 px-3 ${editorDesignClassNames.primaryAction}`}
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              결말 추가
            </button>

            <label className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--mmp-editor-color-slate)]" />
              <input
                type="search"
                aria-label="결말 검색"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="결말 검색"
                className={`min-h-11 w-full pl-9 pr-3 text-sm ${editorDesignClassNames.input}`}
              />
            </label>

            <div className="flex min-w-0 flex-col gap-2">
              {filteredNodes.length === 0 ? (
                <p className={`p-4 text-sm ${editorDesignClassNames.subtlePanel}`}>
                  검색 결과가 없습니다.
                </p>
              ) : (
                filteredNodes.map((node) => {
                  const viewModel = toEndingEditorViewModel(node, {
                    conditionGroupCount: conditionGroupCountByEnding.get(node.id) ?? 0,
                    isDefaultEnding: endingBranchConfig.defaultEnding === node.id,
                  });
                  const selected = selectedNode?.id === node.id;
                  return (
                    <div
                      role="button"
                      tabIndex={0}
                      key={node.id}
                      onClick={() => setSelectedId(node.id)}
                      onKeyDown={(event) => {
                        if (event.key !== 'Enter' && event.key !== ' ') return;
                        event.preventDefault();
                        setSelectedId(node.id);
                      }}
                      aria-pressed={selected}
                      aria-label={`${viewModel.name} 선택`}
                      className={`cursor-pointer p-3 text-left transition ${
                        selected ? editorDesignClassNames.listItemActive : editorDesignClassNames.listItem
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium text-[var(--mmp-editor-color-charcoal)]">{viewModel.name}</p>
                        </div>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            deleteNode(node.id);
                            if (selectedId === node.id) setSelectedId(null);
                          }}
                          className={`p-2 transition ${editorDesignClassNames.iconButton}`}
                          aria-label={`${viewModel.name} 삭제`}
                        >
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                        </button>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1 text-left">
                        {viewModel.badges.map((badge) => (
                          <span
                            key={badge}
                            className={`px-2 py-0.5 text-[11px] ${editorDesignClassNames.tag}`}
                          >
                            {badge}
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </aside>

          {selectedNode && (
            <EndingEntityDetail
              key={selectedNode.id}
              node={selectedNode}
              themeId={themeId}
              onChange={updateNodeData}
              rulesSlot={(
                <EndingBranchRulesPanel
                  themeId={themeId}
                  theme={theme}
                  endingNodes={endingNodes}
                  characters={characters}
                  section="endings"
                  selectedEndingId={selectedNode.id}
                  embedded
                />
              )}
            />
          )}
        </div>
      )}
    </div>
  );
}
