import React, { useState, useEffect, useRef } from 'react';

interface PromptInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  rows?: number;
  className?: string;
}

interface DictionaryEntry {
  primary: string;
  alternatives: string[];
}

interface AnimatedTextProps {
  primary: string;
  alternative: string | null;
}

const AnimatedText: React.FC<AnimatedTextProps> = ({ primary, alternative }) => {
  const [currentText, setCurrentText] = useState(primary);
  const [isAlternative, setIsAlternative] = useState(false);

  useEffect(() => {
    if (!alternative) {
      setCurrentText(primary);
      return;
    }

    const interval = setInterval(() => {
      setIsAlternative(prev => {
        const newIsAlternative = !prev;
        setCurrentText(newIsAlternative ? alternative : primary);
        return newIsAlternative;
      });
    }, 2000); // 2秒ごとに切り替え

    return () => clearInterval(interval);
  }, [primary, alternative]);

  return (
    <span className="transition-all duration-500 ease-in-out">
      {currentText}
    </span>
  );
};

export default function PromptInput({ 
  value, 
  onChange, 
  placeholder, 
  rows = 4, 
  className = '' 
}: PromptInputProps) {
  const [suggestions, setSuggestions] = useState<DictionaryEntry[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [dictionary, setDictionary] = useState<DictionaryEntry[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // dictionary.txtを読み込み
  useEffect(() => {
    loadDictionary();
  }, []);

  const loadDictionary = async () => {
    try {
      const response = await fetch('/api/wildcards');
      if (response.ok) {
        const data = await response.json();
        const dictionaryFile = data.files.find((file: any) => file.name === 'dictionary');
        
        if (dictionaryFile) {
          const entries = parseDictionary(dictionaryFile.content);
          setDictionary(entries);
        }
      }
    } catch (error) {
      console.warn('Failed to load dictionary:', error);
    }
  };

  const parseDictionary = (content: string): DictionaryEntry[] => {
    const entries: DictionaryEntry[] = [];
    const lines = content.split('\n').filter(line => line.trim());

    for (const line of lines) {
      try {
        // [primary], [alt1], [alt2] 形式を解析
        const matches = line.match(/\[([^\]]+)\]/g);
        if (matches && matches.length > 0) {
          const primary = matches[0].slice(1, -1); // [brackets]を除去
          const alternatives = matches.slice(1).map(match => match.slice(1, -1));
          
          entries.push({
            primary,
            alternatives
          });
        }
      } catch (error) {
        console.warn('Failed to parse dictionary line:', line, error);
      }
    }

    return entries;
  };

  const getCurrentWord = (text: string, cursorPosition: number): { word: string; start: number; end: number } => {
    const beforeCursor = text.slice(0, cursorPosition);
    const afterCursor = text.slice(cursorPosition);
    
    // カンマまたは行の始まりまで遡る
    const wordStart = Math.max(
      beforeCursor.lastIndexOf(','),
      beforeCursor.lastIndexOf('\n')
    ) + 1;
    
    // カンマまたは行の終わりまで進む
    const wordEndInAfter = afterCursor.search(/[,\n]/);
    const wordEnd = wordEndInAfter === -1 ? text.length : cursorPosition + wordEndInAfter;
    
    const word = text.slice(wordStart, wordEnd).trim();
    
    return {
      word,
      start: wordStart,
      end: wordEnd
    };
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    const cursorPosition = e.target.selectionStart;
    
    onChange(newValue);
    
    if (dictionary.length === 0) {
      setShowSuggestions(false);
      return;
    }

    const { word } = getCurrentWord(newValue, cursorPosition);
    
    if (word.length >= 2) {
      // 前方一致に変更
      const filteredSuggestions = dictionary.filter(entry => {
        return entry.primary.toLowerCase().startsWith(word.toLowerCase()) ||
               entry.alternatives.some(alt => alt.toLowerCase().startsWith(word.toLowerCase()));
      });
      
      setSuggestions(filteredSuggestions.slice(0, 10)); // 最大10件
      setShowSuggestions(filteredSuggestions.length > 0);
      setSelectedIndex(-1);
    } else {
      setShowSuggestions(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!showSuggestions || suggestions.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % suggestions.length);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => prev <= 0 ? suggestions.length - 1 : prev - 1);
        break;
      case 'Tab':
      case 'Enter':
        if (selectedIndex >= 0) {
          e.preventDefault();
          applySuggestion(suggestions[selectedIndex]);
        }
        break;
      case 'Escape':
        setShowSuggestions(false);
        setSelectedIndex(-1);
        break;
    }
  };

  const applySuggestion = (entry: DictionaryEntry) => {
    if (!textareaRef.current) return;

    const cursorPosition = textareaRef.current.selectionStart;
    const { start, end } = getCurrentWord(value, cursorPosition);
    
    const beforeWord = value.slice(0, start);
    const afterWord = value.slice(end);
    // プロンプト欄に出力されるのは[primary]のみ
    const newValue = beforeWord + entry.primary + afterWord;
    
    onChange(newValue);
    setShowSuggestions(false);
    setSelectedIndex(-1);
    
    // カーソル位置を調整
    setTimeout(() => {
      if (textareaRef.current) {
        const newCursorPos = start + entry.primary.length;
        textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
        textareaRef.current.focus();
      }
    }, 0);
  };

  const handleSuggestionClick = (entry: DictionaryEntry) => {
    applySuggestion(entry);
  };

  const handleBlur = () => {
    // 少し遅延させてクリックイベントを処理可能にする
    setTimeout(() => {
      setShowSuggestions(false);
    }, 200);
  };

  const handleFocus = () => {
    // フォーカス時に現在の入力内容で再度サジェストを表示
    if (textareaRef.current && dictionary.length > 0) {
      const cursorPosition = textareaRef.current.selectionStart;
      const { word } = getCurrentWord(value, cursorPosition);
      
      if (word.length >= 2) {
        const filteredSuggestions = dictionary.filter(entry => {
          return entry.primary.toLowerCase().startsWith(word.toLowerCase()) ||
                 entry.alternatives.some(alt => alt.toLowerCase().startsWith(word.toLowerCase()));
        });
        
        setSuggestions(filteredSuggestions.slice(0, 10));
        setShowSuggestions(filteredSuggestions.length > 0);
        setSelectedIndex(-1);
      }
    }
  };

  return (
    <div className="relative">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        onFocus={handleFocus}
        placeholder={placeholder}
        rows={rows}
        className={`textarea w-full ${className}`}
      />
      
      {showSuggestions && suggestions.length > 0 && (
        <div
          ref={suggestionsRef}
          className="absolute z-50 mt-1 w-full bg-gray-800 border border-gray-600 rounded-lg shadow-lg max-h-60 overflow-y-auto"
        >
          {suggestions.map((entry, index) => (
            <div
              key={`${entry.primary}-${index}`}
              className={`px-3 py-2 cursor-pointer border-b border-gray-700 last:border-b-0 transition-colors duration-150 ${
                index === selectedIndex ? 'bg-blue-600 text-white' : 'hover:bg-gray-700'
              }`}
              onMouseDown={(e) => {
                // onBlurより先に実行されるようにする
                e.preventDefault();
                handleSuggestionClick(entry);
              }}
              onMouseEnter={() => setSelectedIndex(index)}
            >
              <div className="font-medium">
                {/* UI上に表示するのは[primary]と[alt1]のアニメーション */}
                <AnimatedText 
                  primary={entry.primary} 
                  alternative={entry.alternatives.length > 0 ? entry.alternatives[0] : null} 
                />
              </div>
              {entry.alternatives.length > 1 && (
                <div className="text-xs text-gray-400 mt-1">
                  {entry.alternatives.slice(1).join(', ')}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}