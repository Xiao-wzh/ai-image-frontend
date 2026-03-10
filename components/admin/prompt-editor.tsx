"use client"

import React, { useRef, useCallback, useEffect } from "react"

/**
 * Prompt Template Editor with syntax highlighting
 *
 * Uses the "transparent textarea over highlighted div" overlay pattern:
 * - Bottom layer: <div> renders highlighted HTML (variables in color)
 * - Top layer: <textarea> with transparent text + visible caret
 * - Both share identical font/padding/sizing for perfect alignment
 */

interface PromptEditorProps {
    value: string
    onChange: (value: string) => void
    placeholder?: string
    className?: string
}

// Regex patterns for Handlebars + legacy syntax
const HIGHLIGHT_RULES: Array<{
    pattern: RegExp
    className: string
}> = [
        // Handlebars block helpers: {{#if xxx}}, {{#unless xxx}}, {{#each xxx}}
        { pattern: /(\{\{#(?:if|unless|each)\s+\w+\}\})/g, className: "hl-block-open" },
        // Handlebars block close: {{/if}}, {{/unless}}, {{/each}}
        { pattern: /(\{\{\/(?:if|unless|each)\}\})/g, className: "hl-block-close" },
        // Handlebars {{else}}
        { pattern: /(\{\{else\}\})/g, className: "hl-else" },
        // Handlebars variables: {{variableName}}
        { pattern: /(\{\{\w+\}\})/g, className: "hl-variable" },
        // Legacy syntax: ${variableName}
        { pattern: /(\$\{\w+\})/g, className: "hl-legacy" },
    ]

/**
 * Convert raw text to highlighted HTML
 */
function highlightText(text: string): string {
    if (!text) return ""

    // Escape HTML entities first
    let html = text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")

    // Apply highlight rules
    for (const rule of HIGHLIGHT_RULES) {
        html = html.replace(rule.pattern, `<span class="${rule.className}">$1</span>`)
    }

    // Ensure trailing newline for proper height matching
    if (html.endsWith("\n")) {
        html += " "
    }

    return html
}

// CSS injected once as a global style string
const EDITOR_STYLES = `
.prompt-editor-wrapper {
  position: relative;
  display: flex;
  flex-direction: column;
  flex: 1;
}

.prompt-editor-highlight,
.prompt-editor-textarea {
  font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace;
  font-size: 0.875rem;
  line-height: 1.75;
  padding: 0.75rem 1rem;
  margin: 0;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 0.75rem;
  white-space: pre-wrap;
  word-wrap: break-word;
  overflow-wrap: break-word;
  overflow-y: auto;
  tab-size: 2;
  min-height: 400px;
  width: 100%;
  box-sizing: border-box;
}

.prompt-editor-highlight {
  position: absolute;
  inset: 0;
  pointer-events: none;
  color: rgba(226, 232, 240, 0.85);
  background: rgba(255, 255, 255, 0.03);
  z-index: 0;
}

.prompt-editor-textarea {
  position: relative;
  z-index: 1;
  color: transparent;
  caret-color: #60a5fa;
  background: transparent;
  resize: none;
  outline: none;
}

.prompt-editor-textarea:focus {
  border-color: rgba(99, 102, 241, 0.5);
  box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.15);
}

.prompt-editor-placeholder {
  color: rgba(100, 116, 139, 0.6);
}

/* ═══ Syntax Highlight Colors ═══ */

/* Handlebars variables: {{productName}} — cyan pill */
.hl-variable {
  color: #22d3ee;
  background: rgba(34, 211, 238, 0.12);
  padding: 1px 4px;
  border-radius: 4px;
  border: 1px solid rgba(34, 211, 238, 0.2);
  font-weight: 600;
}

/* Block openers: {{#if x}} — emerald */
.hl-block-open {
  color: #34d399;
  background: rgba(52, 211, 153, 0.1);
  padding: 1px 4px;
  border-radius: 4px;
  border: 1px solid rgba(52, 211, 153, 0.2);
  font-weight: 600;
}

/* Block closers: {{/if}} — emerald dimmer */
.hl-block-close {
  color: #34d399;
  background: rgba(52, 211, 153, 0.08);
  padding: 1px 4px;
  border-radius: 4px;
  border: 1px solid rgba(52, 211, 153, 0.15);
  font-weight: 600;
}

/* {{else}} — amber */
.hl-else {
  color: #fbbf24;
  background: rgba(251, 191, 36, 0.1);
  padding: 1px 4px;
  border-radius: 4px;
  border: 1px solid rgba(251, 191, 36, 0.2);
  font-weight: 600;
}

/* Legacy \${var} — amber dashed, wavy underline */
.hl-legacy {
  color: #f59e0b;
  background: rgba(245, 158, 11, 0.12);
  padding: 1px 4px;
  border-radius: 4px;
  border: 1px dashed rgba(245, 158, 11, 0.3);
  font-weight: 600;
  text-decoration: underline;
  text-decoration-style: wavy;
  text-decoration-color: rgba(245, 158, 11, 0.4);
}
`

// Track whether styles are injected
let stylesInjected = false

function injectStyles() {
    if (stylesInjected || typeof document === "undefined") return
    const style = document.createElement("style")
    style.setAttribute("data-prompt-editor", "true")
    style.textContent = EDITOR_STYLES
    document.head.appendChild(style)
    stylesInjected = true
}

export function PromptEditor({ value, onChange, placeholder, className }: PromptEditorProps) {
    const textareaRef = useRef<HTMLTextAreaElement>(null)
    const highlightRef = useRef<HTMLDivElement>(null)

    // Inject styles on mount
    useEffect(() => {
        injectStyles()
    }, [])

    // Sync scroll between textarea and highlight div
    const handleScroll = useCallback(() => {
        if (textareaRef.current && highlightRef.current) {
            highlightRef.current.scrollTop = textareaRef.current.scrollTop
            highlightRef.current.scrollLeft = textareaRef.current.scrollLeft
        }
    }, [])

    // Sync on value change
    useEffect(() => {
        handleScroll()
    }, [value, handleScroll])

    const highlightedHtml = value
        ? highlightText(value)
        : `<span class="prompt-editor-placeholder">${placeholder || ""}</span>`

    return (
        <div className={`prompt-editor-wrapper ${className || ""}`}>
            {/* Highlight backdrop */}
            <div
                ref={highlightRef}
                className="prompt-editor-highlight"
                dangerouslySetInnerHTML={{ __html: highlightedHtml }}
                aria-hidden="true"
            />

            {/* Actual textarea (transparent text, visible caret) */}
            <textarea
                ref={textareaRef}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                onScroll={handleScroll}
                placeholder=""
                className="prompt-editor-textarea"
                spellCheck={false}
            />
        </div>
    )
}
