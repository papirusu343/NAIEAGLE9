import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { WildcardFile } from '../types/novelai';

interface WildcardEditorProps {
  wildcardFiles: WildcardFile[];
  onWildcardUpdate: () => void;
}

export default function WildcardEditor({ wildcardFiles, onWildcardUpdate }: WildcardEditorProps) {
  const [selectedFile, setSelectedFile] = useState<string>('');
  const [fileName, setFileName] = useState<string>('');
  const [content, setContent] = useState<string>('');
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  useEffect(() => {
    if (selectedFile && wildcardFiles.length > 0) {
      const file = wildcardFiles.find(f => f.name === selectedFile);
      if (file) {
        setContent(file.content);
        setFileName(selectedFile);
        setIsEditing(true);
      }
    }
  }, [selectedFile, wildcardFiles]);

  const handleNewFile = () => {
    setSelectedFile('');
    setFileName('');
    setContent('');
    setIsEditing(true);
  };

  const handleSave = async () => {
    if (!fileName.trim()) {
      toast.error('ファイル名を入力してください');
      return;
    }

    if (!content.trim()) {
      toast.error('内容を入力してください');
      return;
    }

    try {
      setIsSaving(true);
      
      const response = await fetch('/api/wildcards', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: fileName.trim(),
          content: content.trim(),
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to save file');
      }

      const result = await response.json();
      toast.success(`ワイルドカードファイル "${result.name}" を保存しました`);
      
      setIsEditing(false);
      setSelectedFile(result.name);
      onWildcardUpdate();
      
    } catch (error: any) {
      console.error('Failed to save wildcard file:', error);
      toast.error(`保存に失敗しました: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedFile) return;

    if (!confirm(`ワイルドカードファイル "${selectedFile}" を削除しますか？`)) {
      return;
    }

    try {
      const response = await fetch('/api/wildcards', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: selectedFile,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete file');
      }

      toast.success(`ワイルドカードファイル "${selectedFile}" を削除しました`);
      
      setSelectedFile('');
      setFileName('');
      setContent('');
      setIsEditing(false);
      onWildcardUpdate();
      
    } catch (error: any) {
      console.error('Failed to delete wildcard file:', error);
      toast.error(`削除に失敗しました: ${error.message}`);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    if (selectedFile) {
      const file = wildcardFiles.find(f => f.name === selectedFile);
      if (file) {
        setContent(file.content);
        setFileName(selectedFile);
      }
    } else {
      setFileName('');
      setContent('');
    }
  };

  return (
    <div className="space-y-6">
      <div className="card">
        <h3 className="text-lg font-semibold mb-4">📝 ワイルドカードエディター</h3>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* ファイル一覧 */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-medium">ファイル一覧</h4>
              <button
                onClick={handleNewFile}
                className="button-primary text-sm"
              >
                + 新規作成
              </button>
            </div>
            
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {wildcardFiles.map((file) => (
                <button
                  key={file.name}
                  onClick={() => setSelectedFile(file.name)}
                  className={`w-full text-left px-3 py-2 rounded border text-sm ${
                    selectedFile === file.name
                      ? 'bg-blue-600 border-blue-500 text-white'
                      : 'bg-gray-800 border-gray-700 hover:bg-gray-700'
                  }`}
                >
                  {file.name}.txt
                </button>
              ))}
              
              {wildcardFiles.length === 0 && (
                <p className="text-gray-400 text-sm text-center py-4">
                  ワイルドカードファイルがありません
                </p>
              )}
            </div>
          </div>

          {/* エディター */}
          <div className="lg:col-span-2 space-y-4">
            {isEditing && (
              <>
                <div>
                  <label className="block text-sm font-medium mb-2">ファイル名</label>
                  <input
                    type="text"
                    value={fileName}
                    onChange={(e) => setFileName(e.target.value)}
                    className="input w-full"
                    placeholder="例: character, pose, background"
                    disabled={!!selectedFile}
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    プロンプトで __ファイル名__ として使用します
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">内容</label>
                  <textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    className="textarea w-full"
                    rows={15}
                    placeholder="一行ずつアイテムを入力してください&#10;&#10;例:&#10;1girl&#10;1boy&#10;2girls&#10;__expression__ girl&#10;beautiful __hair_color__ hair"
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    一行ずつアイテムを記述。他のワイルドカード（__category__）も使用可能
                  </p>
                </div>

                <div className="flex space-x-3">
                  <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="button-primary disabled:opacity-50"
                  >
                    {isSaving ? '保存中...' : '💾 保存'}
                  </button>
                  
                  <button
                    onClick={handleCancel}
                    className="button-secondary"
                  >
                    キャンセル
                  </button>
                  
                  {selectedFile && (
                    <button
                      onClick={handleDelete}
                      className="button-secondary text-red-400 hover:text-red-300"
                    >
                      🗑️ 削除
                    </button>
                  )}
                </div>
              </>
            )}

            {!isEditing && (
              <div className="text-center py-12 text-gray-400">
                <p className="mb-4">📝 ワイルドカードファイルを選択するか、新規作成してください</p>
                <p className="text-sm">
                  ワイルドカードを使用することで、プロンプトにランダムな要素を追加できます
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 使用方法 */}
      <div className="card">
        <h4 className="font-medium mb-3">💡 ワイルドカードの使用方法</h4>
        <div className="text-sm text-gray-400 space-y-2">
          <p>• ファイル名を __ファイル名__ の形式でプロンプトに記述</p>
          <p>• 例: "character.txt" → "__character__"</p>
          <p>• ネスト可能: "beautiful __hair_color__ hair"</p>
          <p>• 同じワイルドカードの連続重複を自動回避</p>
        </div>
      </div>
    </div>
  );
}