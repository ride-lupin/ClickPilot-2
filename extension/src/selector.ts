export type SelectorCandidate = {
  strategy: "css" | "text" | "role";
  value: string;
  confidence: number;
};

export function buildSelectorCandidates(element: Element): SelectorCandidate[] {
  const candidates: SelectorCandidate[] = [];
  const id = element.getAttribute("id");
  const ariaLabel = element.getAttribute("aria-label");
  const text = normalizedText(element);

  if (id) candidates.push({ strategy: "css", value: `#${cssEscape(id)}`, confidence: 95 });

  if (ariaLabel) {
    candidates.push({ strategy: "css", value: `[aria-label="${cssString(ariaLabel)}"]`, confidence: 88 });
    candidates.push({ strategy: "role", value: ariaLabel, confidence: 80 });
  }

  if (text) candidates.push({ strategy: "text", value: text, confidence: 75 });

  candidates.push({ strategy: "css", value: cssPath(element), confidence: 60 });

  return candidates;
}

export function normalizedText(element: Element): string {
  return (element.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 120);
}

function cssEscape(value: string): string {
  return CSS.escape(value);
}

function cssString(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function cssPath(element: Element): string {
  const parts: string[] = [];
  let current: Element | null = element;
  while (current && current.nodeType === Node.ELEMENT_NODE && parts.length < 5) {
    const tag = current.tagName.toLowerCase();
    const parent: Element | null = current.parentElement;
    if (!parent) {
      parts.unshift(tag);
      break;
    }
    const siblings = Array.from(parent.children).filter((child: Element) => child.tagName === current!.tagName);
    const index = siblings.indexOf(current) + 1;
    parts.unshift(siblings.length > 1 ? `${tag}:nth-of-type(${index})` : tag);
    current = parent;
  }
  return parts.join(" > ");
}
