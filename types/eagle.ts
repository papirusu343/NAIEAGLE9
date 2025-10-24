export interface EagleImage {
  id: string;
  name: string;
  size: number;
  ext: string;
  tags: string[];
  folders: string[];
  isDeleted: boolean;
  url: string;
  annotation: string;
  modificationTime: number;
  height: number;
  width: number;
  lastModified: number;
  palettes: any[];
  noThumbnail: boolean;
  metadata?: ImageMetadata;
}

export interface ImageMetadata {
  prompt?: string;
  negativePrompt?: string;
  parameters?: any;
  user?: string;
  generatedAt?: string;
  model?: string;
  source?: string;
}

export interface EagleResponse<T> {
  status: string;
  data: T;
  message?: string;
}