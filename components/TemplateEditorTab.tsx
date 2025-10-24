import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { PromptTemplate, Group, MemberData } from '../utils/promptGenerator';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';

export const TemplateEditorTab: React.FC = () => {
  const [templates, setTemplates] = useState<Array<{ name: string; data: PromptTemplate }>>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [editingTemplate, setEditingTemplate] = useState<PromptTemplate | null>(null);
  const [templateName, setTemplateName] = useState<string>('');
  const [isNewTemplate, setIsNewTemplate] = useState<boolean>(false);

  // 自動保存のためのref
  const autosaveTimeout = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      const response = await fetch('/api/prompt-templates');
      const data = await response.json();
      setTemplates(data.files || []);
    } catch (error) {
      console.error('Failed to load templates:', error);
    }
  };

  const handleTemplateSelect = (templateName: string) => {
    if (!templateName) {
      setEditingTemplate(null);
      setTemplateName('');
      setIsNewTemplate(false);
      return;
    }

    const template = templates.find(t => t.name === templateName);
    if (template) {
      setEditingTemplate(JSON.parse(JSON.stringify(template.data)));
      setTemplateName(templateName);
      setSelectedTemplate(templateName);
      setIsNewTemplate(false);
    }
  };

  const createNewTemplate = () => {
    const newTemplate: PromptTemplate = {
      series: '',
      common: {
        location: ['outdoors', 'indoors', 'school']
      },
      groups: [{
        member_count: 2,
        group_unique: {
          member01: {
            name: ['character1', 'girl1'],
            emotion: ['smile', 'happy']
          },
          member02: {
            name: ['character2', 'girl2'],
            emotion: ['calm', 'serious']
          }
        },
        member_common: {
          outfit: ['school uniform', 'casual clothes']
        }
      }]
    };

    setEditingTemplate(newTemplate);
    setTemplateName('');
    setSelectedTemplate('');
    setIsNewTemplate(true);
  };

  // --- 自動保存 ---
  // 手動保存時のみメッセージ表示
  const saveTemplate = async (showMessage = true) => {
    if (!editingTemplate || !templateName.trim()) {
      if (showMessage) alert('テンプレート名を入力してください');
      return;
    }

    try {
      const response = await fetch('/api/prompt-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: templateName.trim(),
          data: editingTemplate
        })
      });

      if (response.ok) {
        if (showMessage) alert('保存しました');
        await loadTemplates();
        setSelectedTemplate(templateName.trim());
        setIsNewTemplate(false);
      } else {
        const error = await response.json();
        if (showMessage) alert(`保存に失敗しました: ${error.error}`);
      }
    } catch (error) {
      console.error('Save failed:', error);
      if (showMessage) alert('保存に失敗しました');
    }
  };

  // 変更時に自動保存のdebounce
  const triggerAutoSave = useCallback(() => {
    if (autosaveTimeout.current) {
      clearTimeout(autosaveTimeout.current);
    }
    autosaveTimeout.current = setTimeout(() => {
      saveTemplate(false);
    }, 500); // 0.5秒debounce
  }, [templateName, editingTemplate]);

  const deleteTemplate = async () => {
    if (!selectedTemplate || isNewTemplate) return;

    if (!confirm(`テンプレート "${selectedTemplate}" を削除しますか？`)) return;

    try {
      const response = await fetch('/api/prompt-templates', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: selectedTemplate })
      });

      if (response.ok) {
        alert('削除しました');
        await loadTemplates();
        setEditingTemplate(null);
        setTemplateName('');
        setSelectedTemplate('');
        setIsNewTemplate(false);
      } else {
        const error = await response.json();
        alert(`削除に失敗しました: ${error.error}`);
      }
    } catch (error) {
      console.error('Delete failed:', error);
      alert('削除に失敗しました');
    }
  };

  const updateSeries = useCallback((series: string) => {
    if (!editingTemplate) return;
    setEditingTemplate({ ...editingTemplate, series });
  }, [editingTemplate]);

  const addGroup = useCallback(() => {
    if (!editingTemplate) return;
    const newGroup: Group = {
      member_count: 2,
      group_unique: {
        member01: {},
        member02: {}
      },
      member_common: {}
    };
    setEditingTemplate({
      ...editingTemplate,
      groups: [...editingTemplate.groups, newGroup]
    });
    triggerAutoSave();
  }, [editingTemplate, triggerAutoSave]);

  const removeGroup = useCallback((groupIndex: number) => {
    if (!editingTemplate) return;
    const newGroups = editingTemplate.groups.filter((_, index) => index !== groupIndex);
    setEditingTemplate({ ...editingTemplate, groups: newGroups });
    triggerAutoSave();
  }, [editingTemplate, triggerAutoSave]);

  const updateGroup = useCallback((groupIndex: number, updatedGroup: Group) => {
    if (!editingTemplate) return;
    const newGroups = [...editingTemplate.groups];
    newGroups[groupIndex] = updatedGroup;
    setEditingTemplate({ ...editingTemplate, groups: newGroups });
  }, [editingTemplate]);

  const updateGroupField = useCallback((groupIndex: number, field: keyof Group, value: any) => {
    if (!editingTemplate) return;
    const newGroups = [...editingTemplate.groups];
    newGroups[groupIndex] = { ...newGroups[groupIndex], [field]: value };
    setEditingTemplate({ ...editingTemplate, groups: newGroups });
  }, [editingTemplate]);

  const addObjectProperty = useCallback((obj: Record<string, any>, key: string, value: any) => {
    return { ...obj, [key]: value };
  }, []);

  const removeObjectProperty = useCallback((obj: Record<string, any>, key: string) => {
    const newObj = { ...obj };
    delete newObj[key];
    return newObj;
  }, []);

  // ★ 修正: 最大番号 + 1 方式
  const addMember = useCallback((groupIndex: number) => {
    if (!editingTemplate) return;
    const group = editingTemplate.groups[groupIndex];
    const currentUnique = group.group_unique || {};
    const memberKeys = Object.keys(currentUnique);

    // 既存キーから最大番号を抽出
    let maxNum = 0;
    for (const k of memberKeys) {
      const m = k.match(/^member(\d+)$/);
      if (m) {
        const n = parseInt(m[1], 10);
        if (!Number.isNaN(n) && n > maxNum) {
          maxNum = n;
        }
      }
    }

    let nextNum = maxNum + 1;
    // 衝突安全策（理論上 max+1 で衝突しないはずだが保険）
    while (currentUnique[`member${nextNum.toString().padStart(2, '0')}`]) {
      nextNum++;
    }

    const newKey = `member${nextNum.toString().padStart(2, '0')}`;

    const updatedGroup: Group = {
      ...group,
      group_unique: {
        ...currentUnique,
        [newKey]: {}
      }
    };

    updateGroup(groupIndex, updatedGroup);
    triggerAutoSave();
  }, [editingTemplate, updateGroup, triggerAutoSave]);

  const removeMember = useCallback((groupIndex: number, memberKey: string) => {
    if (!editingTemplate) return;
    const group = editingTemplate.groups[groupIndex];
    const newGroupUnique = { ...group.group_unique };
    delete newGroupUnique[memberKey];
    
    const updatedGroup = {
      ...group,
      group_unique: newGroupUnique
    };
    updateGroup(groupIndex, updatedGroup);
    triggerAutoSave();
  }, [editingTemplate, updateGroup, triggerAutoSave]);

  // PropertyEditor修正: 新規追加欄は「追加」ボタン押下時のみ表示、追加/削除時は自動保存
  const PropertyEditor: React.FC<{
    obj: Record<string, any>;
    onChange: (newObj: Record<string, any>) => void;
    title: string;
  }> = React.memo(({ obj, onChange, title }) => {
    const [newKey, setNewKey] = useState('');
    const [newValue, setNewValue] = useState('');
    const [showNewField, setShowNewField] = useState(false);
    // 編集中の値を一時的に保存するstate
    const [editingValues, setEditingValues] = useState<Record<string, string>>({});

    const addProperty = useCallback(() => {
      if (!newKey.trim()) return;
      const lines = newValue
        .split(/\r?\n/)
        .map(v => v.trim())
        .filter(v => v.length > 0);
      const value = lines.length > 1 ? lines : (lines[0] ?? '');
      onChange(addObjectProperty(obj, newKey.trim(), value));
      setNewKey('');
      setNewValue('');
      setShowNewField(false);
      triggerAutoSave();
    }, [newKey, newValue, obj, onChange, addObjectProperty, triggerAutoSave]);

    // 入力値の変更時は一時的にstateに保存
    const handleInputChange = useCallback((key: string, value: string) => {
      setEditingValues(prev => ({ ...prev, [key]: value }));
    }, []);

    // フォーカスが外れた時に実際の値を更新
    const handleInputBlur = useCallback((key: string, value: string) => {
      const lines = value
        .split(/\r?\n/)
        .map(v => v.trim())
        .filter(v => v.length > 0);
      const processedValue = lines.length > 1 ? lines : (lines[0] ?? '');
      onChange({ ...obj, [key]: processedValue });
      
      // 編集中の値をクリア
      setEditingValues(prev => {
        const newValues = { ...prev };
        delete newValues[key];
        return newValues;
      });
    }, [obj, onChange]);

    const handleRemoveProperty = useCallback((key: string) => {
      onChange(removeObjectProperty(obj, key));
      triggerAutoSave();
    }, [obj, onChange, removeObjectProperty, triggerAutoSave]);

    const objectEntries = useMemo(() => Object.entries(obj || {}), [obj]);

    return (
      <div className="rounded border border-gray-600 bg-gray-800/40 p-2 sm:p-3">
        {title && <h5 className="text-sm font-medium text-gray-300 mb-2">{title}</h5>}
        
        {objectEntries.map(([key, value]) => {
          // 編集中の値があればそれを使用、なければ実際の値を表示
            const displayValue = editingValues[key] !== undefined 
            ? editingValues[key] 
            : (Array.isArray(value) ? value.join('\n') : value);

          return (
            <div key={`property-${key}`} className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-2 mb-2">
              <span className="text-xs text-gray-400 sm:w-28 break-words">{key}:</span>
              <div className="flex-1">
                <textarea
                  value={displayValue}
                  onChange={(e) => handleInputChange(key, e.target.value)}
                  onBlur={(e) => handleInputBlur(key, e.target.value)}
                  className="w-full px-2 py-1 text-xs bg-gray-700 border border-gray-600 rounded text-white"
                  rows={Math.min(4, Math.max(1, String(displayValue ?? '').split(/\r?\n/).length))}
                  placeholder="値（改行区切りで配列）"
                />
              </div>
              <div className="flex sm:ml-0 justify-end">
                <button
                  onClick={() => handleRemoveProperty(key)}
                  className="text-red-400 hover:text-red-300 text-xs px-2 py-1"
                >
                  削除
                </button>
              </div>
            </div>
          );
        })}

        {/* 追加ボタンと新規追加欄 */}
        {showNewField ? (
          <div className="mt-2 grid grid-cols-1 sm:grid-cols-[auto,1fr,auto] gap-2">
            <input
              type="text"
              placeholder="キー"
              value={newKey}
              onChange={(e) => setNewKey(e.target.value)}
              className="px-2 py-1 text-xs bg-gray-700 border border-gray-600 rounded text-white w-full"
              autoFocus
            />
            <textarea
              placeholder="値（改行区切りで配列）"
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              className="w-full px-2 py-1 text-xs bg-gray-700 border border-gray-600 rounded text-white"
              rows={3}
            />
            <div className="flex flex-row gap-1">
              <button
                onClick={addProperty}
                className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-3 py-1 rounded"
              >
                追加
              </button>
              <button
                onClick={() => { setShowNewField(false); setNewKey(''); setNewValue(''); }}
                className="bg-gray-600 hover:bg-gray-700 text-white text-xs px-3 py-1 rounded"
              >
                キャンセル
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-2">
            <button
              onClick={() => setShowNewField(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-4 py-1 rounded"
            >
              新規項目を追加
            </button>
          </div>
        )}
      </div>
    );
  });

  // 並び替え用ユーティリティ
  const reorder = <T,>(list: T[], startIndex: number, endIndex: number): T[] => {
    const result = Array.from(list);
    const [removed] = result.splice(startIndex, 1);
    result.splice(endIndex, 0, removed);
    return result;
  };

  // グループ単位のドラッグ終了ハンドラ
  const getHandleDragEndForGroup = (groupIndex: number) => (result: DropResult) => {
    if (!editingTemplate) return;
    if (!result.destination) return;

    const group = editingTemplate.groups[groupIndex];
    const memberKeys = Object.keys(group.group_unique || {});
    const newOrderKeys = reorder(memberKeys, result.source.index, result.destination.index);

    // 並び替えた順序でオブジェクトを再構築
    const reorderedUnique: Record<string, MemberData> = {};
    newOrderKeys.forEach(k => {
      reorderedUnique[k] = group.group_unique[k];
    });

    const updatedGroup: Group = {
      ...group,
      group_unique: reorderedUnique
    };

    updateGroup(groupIndex, updatedGroup);
    triggerAutoSave();
  };

  // ここから下、memberKeyの表示を消しfirstValueのみsummary表示
  return (
    <div className="space-y-4 sm:space-y-6 pb-20">
      <div className="card">
        <h3 className="text-lg sm:text-xl font-semibold mb-4 sm:mb-6 text-gray-100">📝 JSON テンプレート編集</h3>
        
        {/* テンプレート選択・操作 */}
        <div className="mb-4 sm:mb-6 space-y-2 sm:space-y-3">
          <div className="flex flex-col sm:flex-row gap-2">
            <select
              value={selectedTemplate}
              onChange={(e) => handleTemplateSelect(e.target.value)}
              className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            >
              <option value="">テンプレートを選択...</option>
              {templates.map((template) => (
                <option key={template.name} value={template.name}>
                  {template.name}
                </option>
              ))}
            </select>
            <button
              onClick={createNewTemplate}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md whitespace-nowrap text-sm"
            >
              新規作成
            </button>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              placeholder="テンプレート名"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
            {/* PCサイズの操作ボタン */}
            <div className="hidden sm:flex gap-2">
              <button
                onClick={() => saveTemplate(true)}
                disabled={!editingTemplate}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-4 py-2 rounded-md whitespace-nowrap text-sm"
              >
                保存
              </button>
              <button
                onClick={deleteTemplate}
                disabled={!selectedTemplate || isNewTemplate}
                className="bg-red-600 hover:bg-red-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-4 py-2 rounded-md whitespace-nowrap text-sm"
              >
                削除
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* テンプレート編集フォーム */}
      {editingTemplate && (
        <div className="card">
          <h4 className="text-base sm:text-lg font-semibold text-gray-100 mb-4 sm:mb-6">⚙️ テンプレート設定</h4>
          
          {/* シリーズ名 */}
          <div className="mb-4 sm:mb-6">
            <label className="block text-xs sm:text-sm font-medium text-gray-300 mb-1 sm:mb-2">
              シリーズ名
            </label>
            <input
              type="text"
              value={editingTemplate.series}
              onChange={(e) => updateSeries(e.target.value)}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              placeholder="例: アイドルマスター"
            />
          </div>

          {/* Common（シリーズ共通設定） */}
          <details className="rounded border border-gray-600 p-2 mb-4">
            <summary className="cursor-pointer list-none text-sm text-white">
              Common（シリーズ共通設定）
            </summary>
            <div className="mt-2">
              <PropertyEditor
                obj={editingTemplate.common || {}}
                onChange={(newObj) => setEditingTemplate({ ...editingTemplate, common: newObj })}
                title=""
              />
            </div>
          </details>

          {/* グループ設定 */}
          <div>
            <div className="flex justify-between items-center mb-3 sm:mb-4">
              <h5 className="text-sm font-medium text-gray-300">グループ設定</h5>
              <button
                onClick={addGroup}
                className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-xs sm:text-sm"
              >
                グループ追加
              </button>
            </div>

            {editingTemplate.groups.map((group, groupIndex) => {
              // メンバーキーの表示順（オブジェクト挿入順）
              const memberKeys = Object.keys(group.group_unique || {});
              return (
                <details key={`group-${groupIndex}`} className="border border-gray-600 rounded-lg p-3 sm:p-4 mb-3 sm:mb-4">
                  <summary className="cursor-pointer list-none flex items-center justify-between">
                    <span className="text-sm font-medium text-white">
                      グループ {groupIndex + 1}（メンバー数: {group.member_count}）
                    </span>
                    <span className="text-xs text-gray-400 ml-2">タップで展開</span>
                  </summary>

                  <div className="mt-3 space-y-3 sm:space-y-4">
                    <div className="flex justify-between items-center">
                      <div className="text-xs text-gray-400">グループ操作</div>
                      <button
                        onClick={() => removeGroup(groupIndex)}
                        className="text-red-400 hover:text-red-300 text-xs"
                      >
                        グループ削除
                      </button>
                    </div>

                    {/* メンバー数 */}
                    <div>
                      <label className="block text-xs font-medium text-gray-400 mb-1">
                        メンバー数
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={group.member_count}
                        onChange={(e) => updateGroupField(groupIndex, 'member_count', parseInt(e.target.value) || 1)}
                        className="w-24 px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white text-sm"
                      />
                    </div>

                    {/* Member Common */}
                    <details className="rounded border border-gray-600 p-2">
                      <summary className="cursor-pointer list-none text-sm text-white">
                        Member Common (メンバー共通設定)
                      </summary>
                      <div className="mt-2">
                        <PropertyEditor
                          obj={group.member_common}
                          onChange={(newObj) => updateGroupField(groupIndex, 'member_common', newObj)}
                          title=""
                        />
                      </div>
                    </details>

                    {/* Group Unique (メンバー個別設定) */}
                    <div className="rounded border border-gray-600 p-2">
                      <div className="flex justify-between items-center mb-2">
                        <h6 className="text-sm font-medium text-gray-300">Group Unique (メンバー個別設定)</h6>
                        <button
                          onClick={() => addMember(groupIndex)}
                          className="bg-blue-600 hover:bg-blue-700 text-white px-2 py-1 rounded text-xs"
                        >
                          メンバー追加
                        </button>
                      </div>

                      {/* DnDでメンバー並び替え */}
                      <DragDropContext onDragEnd={getHandleDragEndForGroup(groupIndex)}>
                        <Droppable droppableId={`members-${groupIndex}`}>
                          {(dropProvided) => (
                            <div ref={dropProvided.innerRef} {...dropProvided.droppableProps}>
                              {memberKeys.map((memberKey, idx) => {
                                const memberData = group.group_unique[memberKey] || {};
                                // 1番目の項目の値取得
                                let firstValue = "-";
                                const memberEntries = Object.entries(memberData ?? {});
                                if (memberEntries.length > 0) {
                                  const v = memberEntries[0][1];
                                  if (Array.isArray(v)) {
                                    firstValue = v.length > 0 ? v[0] : "-";
                                  } else if (typeof v === "string" || typeof v === "number") {
                                    firstValue = v as string;
                                  } else if (typeof v === "object" && v !== null) {
                                    firstValue = JSON.stringify(v);
                                  } else {
                                    firstValue = "-";
                                  }
                                }

                                return (
                                  <Draggable key={memberKey} draggableId={memberKey} index={idx}>
                                    {(dragProvided, snapshot) => (
                                      <div
                                        ref={dragProvided.innerRef}
                                        {...dragProvided.draggableProps}
                                        className={`border border-gray-500 rounded p-2 mb-2 bg-gray-800/40 ${snapshot.isDragging ? 'ring-2 ring-blue-500' : ''}`}
                                      >
                                        <details className="group">
                                          <summary className="cursor-pointer list-none flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                              {/* ドラッグハンドル */}
                                              <span
                                                {...dragProvided.dragHandleProps}
                                                className="text-gray-400 hover:text-gray-200 cursor-grab select-none"
                                                title="ドラッグで並び替え"
                                              >
                                                ↕︎
                                              </span>
                                              <span className="text-xs font-medium text-gray-300 break-words">
                                                {firstValue}
                                              </span>
                                            </div>
                                            <button
                                              onClick={(e) => { e.preventDefault(); removeMember(groupIndex, memberKey); }}
                                              className="text-red-400 hover:text-red-300 text-xs"
                                            >
                                              削除
                                            </button>
                                          </summary>
                                          <div className="mt-2">
                                            <PropertyEditor
                                              obj={memberData}
                                              onChange={(newObj) => {
                                                const updatedGroup = {
                                                  ...group,
                                                  group_unique: {
                                                    ...group.group_unique,
                                                    [memberKey]: newObj
                                                  }
                                                };
                                                updateGroup(groupIndex, updatedGroup);
                                              }}
                                              title=""
                                            />
                                          </div>
                                        </details>
                                      </div>
                                    )}
                                  </Draggable>
                                );
                              })}
                              {dropProvided.placeholder}
                            </div>
                          )}
                        </Droppable>
                      </DragDropContext>
                    </div>
                  </div>
                </details>
              );
            })}
          </div>
        </div>
      )}

      {/* 使用方法の説明（折りたたみ） */}
      <div className="card">
        <details>
          <summary className="cursor-pointer list-none">
            <h4 className="inline text-base sm:text-lg font-semibold text-gray-100 mb-0">
              💡 使用方法
            </h4>
            <span className="ml-2 text-xs text-gray-400">タップで展開</span>
          </summary>
          <div className="mt-3 text-xs sm:text-sm text-gray-400 space-y-2">
            <p><strong>1. テンプレート構造:</strong></p>
            <p className="ml-4">• <code>series</code>: 作品名（アイドルマスター等）</p>
            <p className="ml-4">• <code>common</code>: シリーズ共通の設定（場所、時間、スタイル等）</p>
            <p className="ml-4">• <code>groups</code>: 複数のグループ（ランダムに1つ選択）</p>

            <p><strong>2. グループ内の要素:</strong></p>
            <p className="ml-4">• <code>member_count</code>: 生成するキャラクター数</p>
            <p className="ml-4">• <code>member_common</code>: キャラクター共通の設定</p>
            <p className="ml-4">• <code>group_unique</code>: キャラクター個別の設定</p>

            <p><strong>3. 配列値:</strong> 改行区切りで入力すると配列になり、ランダムに1つ選択されます</p>

            <p><strong>4. 変数の使い方:</strong></p>
            <p className="ml-4">• <code>[common:location]</code>: テンプレート直下の common を参照</p>
            <p className="ml-4">• <code>[member_common:outfit]</code>: member_common の設定値</p>
            <p className="ml-4">• <code>[group_unique:name]</code>: 各キャラクター固有の設定値</p>
          </div>
        </details>
      </div>

      {/* モバイル用固定アクションバー */}
      {editingTemplate && (
        <div className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-gray-900/95 border-t border-gray-700 px-3 py-2 flex gap-2 justify-end">
          <button
            onClick={deleteTemplate}
            disabled={!selectedTemplate || isNewTemplate}
            className="bg-red-600 hover:bg-red-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-3 py-2 rounded-md text-sm"
          >
            削除
          </button>
          <button
            onClick={() => saveTemplate(true)}
            disabled={!editingTemplate}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-3 py-2 rounded-md text-sm"
          >
            保存
          </button>
        </div>
      )}
    </div>
  );
};