export interface CaretCoords {
  top: number;
  left: number;
  height: number;
}

/**
 * 用隐藏 mirror div 复刻 textarea 的排版，量出光标在视口内的坐标，
 * 供 `[[` 搜索浮层定位。调用方负责在 textarea 处于编辑态时调用。
 */
export function getCaretCoordinates(
  textarea: HTMLTextAreaElement,
  text: string,
  caretPos: number
): CaretCoords | null {
  const style = getComputedStyle(textarea);
  const mirror = document.createElement("div");
  mirror.style.cssText = [
    "position:absolute",
    "visibility:hidden",
    "white-space:pre-wrap",
    "overflow-wrap:break-word",
    `width:${textarea.clientWidth}px`,
    `font:${style.font}`,
    `font-family:${style.fontFamily}`,
    `font-size:${style.fontSize}`,
    `font-weight:${style.fontWeight}`,
    `font-style:${style.fontStyle}`,
    `letter-spacing:${style.letterSpacing}`,
    `line-height:${style.lineHeight}`,
    `padding-top:${style.paddingTop}`,
    `padding-right:${style.paddingRight}`,
    `padding-bottom:${style.paddingBottom}`,
    `padding-left:${style.paddingLeft}`,
    `border-top-width:${style.borderTopWidth}`,
    `border-right-width:${style.borderRightWidth}`,
    `border-bottom-width:${style.borderBottomWidth}`,
    `border-left-width:${style.borderLeftWidth}`,
    `box-sizing:${style.boxSizing}`,
    `tab-size:${style.tabSize}`,
  ].join(";");
  mirror.textContent = text.slice(0, caretPos);
  const marker = document.createElement("span");
  marker.style.position = "relative";
  marker.textContent = "​"; // zero-width space
  mirror.appendChild(marker);
  document.body.appendChild(mirror);

  const rect = textarea.getBoundingClientRect();
  const mirrorRect = mirror.getBoundingClientRect();
  const markerRect = marker.getBoundingClientRect();

  const coords: CaretCoords = {
    top: rect.top + (markerRect.top - mirrorRect.top),
    left: rect.left + (markerRect.left - mirrorRect.left),
    height: markerRect.height,
  };

  document.body.removeChild(mirror);
  return coords;
}
