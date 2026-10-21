/** 입력 중인 요소에서 발생한 키 입력이면 전역 단축키를 무시해야 한다. */
export function isEditableTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement
    && Boolean(target.closest('input, textarea, select, [contenteditable="true"]'))
  )
}

export function hasModifier(event: KeyboardEvent): boolean {
  return event.ctrlKey || event.metaKey || event.altKey
}
