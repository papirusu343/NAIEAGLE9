import React, { useState, useEffect } from 'react';
import { wildcardService } from '../utils/wildcard';
import { WildcardFile } from '../types/wildcard';
import toast from 'react-hot-toast';

export default function WildcardManager() {
  const [wildcardFiles, setWildcardFiles] = useState<WildcardFile[]>([]);
  const [selectedFile, setSelectedFile] = useState<WildcardFile | null>(null);
  const [editingContent, setEditingContent] = useState('');
  const [newFileName, setNewFileName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [previewPrompt, setPreviewPrompt] = useState('__girl__, __hair_color__, __eye_color__, __clothing__, __pose__, __background__, __style__, __quality__');
  const [previewResults, setPreviewResults] = useState<string[]>([]);

  useEffect(() => {
    loadWildcardFiles();
    // デフォルトwildcardを初期化
    wildcardService.initializeDefaultWildcards();
  }, []);

  const loadWildcardFiles = () => {
    const files = wildcardService.getWildcardFiles();
    setWildcardFiles(files);
  };

  const handleSelectFile = (file: WildcardFile) => {
    setSelectedFile(file);
    setEditingContent(file.content.join('\n'));
    setIsCreating(false);
  };

  const handleSaveFile = () => {
    if (!selectedFile && !isCreating) return;
    
    const fileName = isCreating ? newFileName : selectedFile!.name;
    if (!fileName.trim()) {
      toast.error('ファイル名を入力してください');
      return;
    }

    wildcardService.createOrUpdateWildcard(fileName.trim(), editingContent);
    loadWildcardFiles();
    
    if (isCreating) {
      toast.success(`ワイルドカード "${fileName}" を作成しました`);
      setIsCreating(false);
      setNewFileName('');
    } else {
      toast.success(`ワイルドカード "${fileName}" を保存しました`);
    }
  };

  const handleDeleteFile = (fileName: string) => {
    if (confirm(`ワイルドカード "${fileName}" を削除しますか？`)) {
      wildcardService.deleteWildcard(fileName);
      loadWildcardFiles();
      if (selectedFile?.name === fileName) {
        setSelectedFile(null);
        setEditingContent('');
      }
      toast.success(`ワイルドカード "${fileName}" を削除しました`);
    }
  };

  const handleCreateNew = () => {
    setIsCreating(true);
    setSelectedFile(null);
    setEditingContent('');
    setNewFileName('');
  };

  const handlePreview = () => {
    if (!previewPrompt.trim()) {
      toast.error('プレビュー用プロンプトを入力してください');
      return;
    }
    
    const results = wildcardService.previewPrompt(previewPrompt, 5);
    setPreviewResults(results);
  };

  return (
    <div className="space-y-6">
      <div className="card">
        <h2 className="text-xl font-semibold mb-4">🎲 ワイルドカード管理</h2>
        <div className="text-sm text-gray-400 mb-4">
          <p>ワイルドカードを使用して、プロンプトに変化を加えることができます。</p>
          <p>形式: __カテゴリ名__ （例: __girl__, __hair_color__）</p>
          <p>ネスト対応: ワイルドカード内で他のワイルドカードを使用できます</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ファイル一覧 */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">ワイルドカードファイル</h3>
            <button
              onClick={handleCreateNew}
              className="button-primary text-sm"
            >
              + 新規作成
            </button>
          </div>

          <div className="space-y-2 max-h-96 overflow-y-auto">
            {wildcardFiles.map((file) => (
              <div
                key={file.name}
                className={`p-3 rounded border cursor-pointer transition-colors ${
                  selectedFile?.name === file.name
                    ? 'border-blue-500 bg-blue-900/20'
                    : 'border-gray-600 hover:border-gray-500'
                }`}
                onClick={() => handleSelectFile(file)}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">__{file.name}__</div>
                    <div className="text-xs text-gray-400">
                      {file.content.length} 項目 • {new Date(file.lastModified).toLocaleString()}
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteFile(file.name);
                    }}
                    className="text-red-400 hover:text-red-300 text-sm"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* エディター */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">
              {isCreating ? '新規ワイルドカード' : selectedFile ? `編集: __${selectedFile.name}__` : 'ワイルドカードを選択'}
            </h3>
            {(selectedFile || isCreating) && (
              <button
                onClick={handleSaveFile}
                className="button-primary text-sm"
              >
                💾 保存
              </button>
            )}
          </div>

          {isCreating && (
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">ファイル名</label>
              <input
                type="text"
                value={newFileName}
                onChange={(e) => setNewFileName(e.target.value)}
                className="input w-full"
                placeholder="例: hair_style"
              />
            </div>
          )}

          {(selectedFile || isCreating) && (
            <div>
              <label className="block text-sm font-medium mb-2">
                内容（1行に1つの項目を記入）
              </label>
              <textarea
                value={editingContent}
                onChange={(e) => setEditingContent(e.target.value)}
                className="textarea w-full"
                rows={12}
                placeholder={`例:\nblonde hair\nbrown hair\nblack hair\n__hair_color__ and __eye_color__`}
              />
              <div className="text-xs text-gray-400 mt-1">
                ワイルドカード内で他のワイルドカードを使用できます（ネスト）
              </div>
            </div>
          )}
        </div>
      </div>

      {/* プレビュー機能 */}
      <div className="card">
        <h3 className="text-lg font-semibold mb-4">🔍 プロンプトプレビュー</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">テスト用プロンプト</label>
            <div className="flex space-x-2">
              <input
                type="text"
                value={previewPrompt}
                onChange={(e) => setPreviewPrompt(e.target.value)}
                className="input flex-1"
                placeholder="__girl__, __hair_color__, __eye_color__"
              />
              <button
                onClick={handlePreview}
                className="button-primary"
              >
                プレビュー生成
              </button>
            </div>
          </div>

          {previewResults.length > 0 && (
            <div>
              <label className="block text-sm font-medium mb-2">生成例（5パターン）</label>
              <div className="space-y-2">
                {previewResults.map((result, index) => (
                  <div
                    key={index}
                    className="p-3 bg-gray-800 rounded border border-gray-600 text-sm"
                  >
                    {result}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}