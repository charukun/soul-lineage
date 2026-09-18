// Browser presentation helpers; game rules must never import this package.
export function showStatus(element, text, state = 'ready') { element.textContent = text; element.dataset.state = state; }
