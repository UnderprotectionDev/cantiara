export function popupReturnFocus(elementId?: string): HTMLElement | true {
  return elementId ? (document.getElementById(elementId) ?? true) : true;
}
