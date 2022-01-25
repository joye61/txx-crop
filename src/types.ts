export type ControlType =
  | "s1" // 上边
  | "s2" // 右边
  | "s3" // 下边
  | "s4" // 左边
  | "a1" // 左上角
  | "a2" // 右上角
  | "a3" // 右下角
  | "a4" // 左下角
  | "move" // 中间可移动区
  | "image"; // 图片可移动区

// 鼠标指针类型
export enum CursorType {
  // 上边和下边的鼠标样式
  s1s3 = "ns-resize",
  // 左边和右边的鼠标样式
  s2s4 = "ew-resize",
  // 左上角和右下角的鼠标样式
  a1a3 = "nwse-resize",
  // 右上角和左下角的鼠标样式
  a2a4 = "nesw-resize",
  // 移动时的鼠标样式
  move = "move",
}

export type CursorSets = {
  [key in ControlType]: CursorType;
};

export interface TxxCropOption {
  // 裁剪画布的容器
  container: string | HTMLElement;
  // 预览画布的容器
  previewContainer?: string | HTMLElement;
  // 关键颜色
  primaryColor?: string | number;
  // 显示网格背景，如果不设置，则默认全透明
  showGridBackground: boolean;
  // 预览框显示网格背景，如果不设置，则默认全透明
  showGridPreviewBackground: boolean;
  // 裁剪时的宽高比，如果不存在，则自由裁剪
  ratio?: number;
  // 裁剪宽度
  cropWidth?: number;
  // 裁剪高度
  cropHeight?: number;
  // 默认的裁剪框宽度
  defaultCropBoxWidth?: number;
  // 显示裁剪线
  showCropMesh?: boolean;
}

export interface DOMInfo {
  // 元素宽度
  width: number;
  // 元素高度
  height: number;
  // 元素引用
  element: HTMLElement;
}

export interface RatioChangeOption {
  /**
   * free: 自由裁剪
   * ratio: 按照固定比例裁剪
   * fixed: 固定宽高裁剪
   */
  type: "free" | "ratio" | "fixed";
  ratio?: number;
  cropWidth?: number;
  cropHeight?: number;
}
