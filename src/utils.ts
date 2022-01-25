import { DOMInfo } from "./types";
import colorString from "color-string";

/**
 * 创建一个下载对象
 * @param {*} name 下载对象的名字
 * @param {*} file Blob
 */
export function createDownload(name: string, file: Blob) {
  const link = document.createElement("a");
  link.download = name;
  link.href = URL.createObjectURL(file);
  link.click();
  link.remove();
}

/**
 * 检测passive是否被支持
 */
export function isPassiveSupport() {
  let passiveSupported = false;
  try {
    window.addEventListener(
      "__passive_test",
      () => undefined,
      Object.defineProperty({}, "passive", {
        get() {
          passiveSupported = true;
        },
      })
    );
  } catch (err) {}
  return passiveSupported;
}

/**
 * 根据选择器获取元素的引用、宽度和高度
 * @param selector
 * @returns
 */
export function getDomInfo(selector?: string | HTMLElement): null | DOMInfo {
  let el: null | HTMLElement = null;
  if (typeof selector === "string") {
    el = document.querySelector(selector);
  } else if (selector instanceof HTMLElement) {
    el = selector;
  }
  if (el instanceof HTMLElement) {
    const { width, height } = el.getBoundingClientRect();
    return { width, height, element: el };
  }
  return null;
}

/**
 * 获取有效的pixijs颜色值
 * @param color
 * @returns
 */
export function getColor(color: number | string) {
  if (typeof color === "number") {
    return color;
  }
  if (typeof color === "string") {
    const result = colorString.get(color);
    if (result) {
      const hexStr = colorString.to.hex(result.value).replace(/^\#/, "0x");
      return Number(hexStr);
    }
  }
  throw new Error("Invalid color value");
}
