export interface WildcardFile {
  name: string;
  path: string;
  content: string[];
  lastModified: number;
}

export interface WildcardManager {
  files: Map<string, WildcardFile>;
  recentSelections: Map<string, string[]>;
}

export interface ParsedWildcard {
  category: string;
  selected: string;
}

export const WILDCARD_STORAGE_KEY = 'novelai_wildcards';
export const WILDCARD_RECENT_KEY = 'novelai_wildcard_recent';