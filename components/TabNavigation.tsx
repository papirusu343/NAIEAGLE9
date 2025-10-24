import React, { useEffect, useMemo, useRef } from 'react';

type Tab = {
  id: string;
  label: string;
  icon?: React.ReactNode;
};

interface TabNavigationProps {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (id: string) => void;
}

/**
 * 横スクロール可能なタブバー
 * - 小さい画面では横スクロール（overflow-x-auto）
 * - タブは折り返さず1行表示（whitespace-nowrap, min-w-max）
 * - アクティブタブを自動で中央へスクロール
 */
const TabNavigation: React.FC<TabNavigationProps> = ({ tabs, activeTab, onTabChange }) => {
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  // アクティブタブが変わったら中央へスクロール
  useEffect(() => {
    const el = tabRefs.current[activeTab];
    const container = scrollContainerRef.current;
    if (!el || !container) return;

    // スクロール領域内でアクティブタブを中央へ
    const elRect = el.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    const overLeft = elRect.left - containerRect.left;
    const offset = overLeft - (container.clientWidth / 2 - el.clientWidth / 2);
    container.scrollTo({
      left: container.scrollLeft + offset,
      behavior: 'smooth',
    });
  }, [activeTab]);

  // シンプルなクラス
  const baseTabClass =
    'inline-flex items-center gap-2 px-3 py-2 rounded-md border text-sm transition-colors whitespace-nowrap';
  const activeClass =
    'bg-blue-600 border-blue-500 text-white hover:bg-blue-600';
  const inactiveClass =
    'bg-gray-800 border-gray-700 text-gray-200 hover:bg-gray-700';

  return (
    <div className="mb-6">
      <div
        ref={scrollContainerRef}
        className="overflow-x-auto overscroll-x-contain"
        style={{
          WebkitOverflowScrolling: 'touch',
        }}
      >
        <div className="min-w-max inline-flex gap-2 py-2 pr-2">
          {tabs.map((tab) => {
            const isActive = tab.id === activeTab;
            return (
              <button
                key={tab.id}
                ref={(el) => {
                  tabRefs.current[tab.id] = el;
                }}
                onClick={() => onTabChange(tab.id)}
                className={`${baseTabClass} ${isActive ? activeClass : inactiveClass}`}
                type="button"
              >
                {tab.icon ? <span className="shrink-0">{tab.icon}</span> : null}
                <span className="truncate">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default TabNavigation;