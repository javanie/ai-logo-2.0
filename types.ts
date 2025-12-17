export enum ToolType {
  IMPORT = 'IMPORT',
  REMOVE = 'REMOVE',
  WATERMARK = 'WATERMARK',
  ADJUST = 'ADJUST',
  EXPORT = 'EXPORT'
}

export enum WatermarkType {
  TEXT = 'TEXT',
  IMAGE = 'IMAGE',
  AI_INVISIBLE = 'AI_INVISIBLE' 
}

export type WatermarkShape = 'NONE' | 'CIRCLE' | 'DOUBLE_CIRCLE' | 'SQUARE' | 'ROUNDED' | 'BRACKETS';

export interface WatermarkConfig {
  type: WatermarkType;
  text: string;
  imageUrl?: string | null; // For Image Watermarks
  color: string;
  opacity: number;
  size: number;
  rotation: number;
  isTiled: boolean;
  tileDensity: number;
  fontFamily: string;
  fontWeight: string; // '400' | '700'
  letterSpacing: number; // px
  shadowColor: string;
  shadowBlur: number;
  x: number; // 0-100 Percentage
  y: number; // 0-100 Percentage
  
  // New Logo/Seal Properties
  shape: WatermarkShape;
  borderColor: string;
  borderWidth: number;
  padding: number;
}

export interface AdjustmentConfig {
  brightness: number; // 0-200, default 100
  contrast: number; // 0-200, default 100
  saturation: number; // 0-200, default 100
  blur: number; // 0-10, default 0
  sepia: number; // 0-100
}

export interface Point {
  x: number; // percentage 0-100
  y: number; // percentage 0-100
}

export interface MaskPath {
  points: Point[];
  size: number;
}

export interface ImageState {
  id: string;
  originalUrl: string;
  processedUrl: string | null; // Result from AI removal
  thumbnailUrl: string;
  name: string;
  type: string;
  watermark: WatermarkConfig;
  adjustments: AdjustmentConfig;
  aiAnalysis?: string; // Cache for AI detection results
  maskPaths: MaskPath[]; // Manual eraser strokes
}

export const DEFAULT_WATERMARK: WatermarkConfig = {
  type: WatermarkType.TEXT,
  text: 'CleanLens AI',
  imageUrl: null,
  color: '#ffffff',
  opacity: 90,
  size: 32,
  rotation: 0,
  isTiled: false,
  tileDensity: 3,
  fontFamily: "'Montserrat', sans-serif",
  fontWeight: '700',
  letterSpacing: 2,
  shadowColor: 'rgba(0,0,0,0.5)',
  shadowBlur: 10,
  x: 50,
  y: 50,
  shape: 'NONE',
  borderColor: '#ffffff',
  borderWidth: 0,
  padding: 20
};

export const DEFAULT_ADJUSTMENTS: AdjustmentConfig = {
  brightness: 100,
  contrast: 100,
  saturation: 100,
  blur: 0,
  sepia: 0
};