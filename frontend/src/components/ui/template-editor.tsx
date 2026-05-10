'use client'

import { useEffect, useRef, useCallback, useMemo } from 'react'
import { EditorState, Compartment } from '@codemirror/state'
import { EditorView, keymap, placeholder as placeholderExt, ViewUpdate } from '@codemirror/view'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { 
  HighlightStyle, 
  syntaxHighlighting,
  StreamLanguage
} from '@codemirror/language'
import { tags } from '@lezer/highlight'
import { cn } from '@/lib/utils'

// =============================================================================
// Custom Language for Template Variables
// =============================================================================

/**
 * StreamLanguage parser for {{variable}} syntax
 * Tokenizes template variables for syntax highlighting
 */
function createTemplateLanguage(validKeys: Set<string>) {
  return StreamLanguage.define({
    token(stream) {
      // Check for {{variable}} pattern
      if (stream.match('{{')) {
        // Read variable name
        const varName: string[] = []
        while (!stream.eol()) {
          if (stream.match('}}')) {
            const key = varName.join('').trim()
            if (validKeys.has(key)) {
              return 'variableName' // Valid variable
            }
            return 'invalid' // Invalid variable
          }
          varName.push(stream.next() || '')
        }
        return 'invalid' // Unclosed {{
      }
      
      // Skip to next potential variable or end of line
      while (!stream.eol()) {
        if (stream.peek() === '{') {
          if (stream.match('{{', false)) {
            return null
          }
        }
        stream.next()
      }
      return null
    },
  })
}

// =============================================================================
// Highlight Styles
// =============================================================================

/**
 * Theme for valid/invalid variable highlighting
 * Uses inline styles that work in both light and dark mode
 */
const variableHighlightStyle = HighlightStyle.define([
  { 
    tag: tags.variableName, 
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    color: '#3b82f6',
    borderRadius: '3px',
    padding: '1px 2px',
  },
  { 
    tag: tags.invalid, 
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    color: '#ef4444',
    borderRadius: '3px',
    padding: '1px 2px',
  },
])

/**
 * Base theme for the editor appearance
 * Note: Dark mode is handled via CSS variables from the parent app
 */
const baseTheme = EditorView.theme({
  '&': {
    fontSize: '14px',
    fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
  },
  '&.cm-focused': {
    outline: 'none',
  },
  '.cm-scroller': {
    fontFamily: 'inherit',
  },
  '.cm-content': {
    caretColor: 'hsl(var(--foreground))',
    padding: '12px',
  },
  '.cm-line': {
    padding: '0',
  },
  '.cm-placeholder': {
    color: 'hsl(var(--muted-foreground))',
    fontStyle: 'normal',
  },
})

// =============================================================================
// Component Props
// =============================================================================

interface TemplateEditorProps {
  /** Current value */
  value: string
  /** Change handler */
  onChange: (value: string) => void
  /** Placeholder text */
  placeholder?: string
  /** Valid variable keys for highlighting */
  variableKeys: string[]
  /** Additional CSS classes */
  className?: string
  /** Minimum height */
  minHeight?: string
  /** Is single line mode (like an input) */
  singleLine?: boolean
  /** HTML id for the editor */
  id?: string
}

/**
 * CodeMirror-based template editor with {{variable}} syntax highlighting
 * 
 * Features:
 * - Syntax highlighting for valid/invalid variables
 * - Undo/redo support
 * - Proper cursor positioning
 * - Dark mode support
 */
export function TemplateEditor({
  value,
  onChange,
  placeholder,
  variableKeys,
  className,
  minHeight = '200px',
  singleLine = false,
  id,
}: TemplateEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const languageCompartment = useRef(new Compartment())
  
  // Memoize the valid keys set
  const validKeysSet = useMemo(() => new Set(variableKeys), [variableKeys])
  
  // Update handler - called when editor content changes
  const handleUpdate = useCallback((update: ViewUpdate) => {
    if (update.docChanged) {
      const newValue = update.state.doc.toString()
      onChange(newValue)
    }
  }, [onChange])
  
  // Initialize editor
  useEffect(() => {
    if (!containerRef.current || viewRef.current) return
    
    const language = createTemplateLanguage(validKeysSet)
    
    const extensions = [
      // Basic editing
      history(),
      keymap.of([...defaultKeymap, ...historyKeymap]),
      
      // Language and highlighting
      languageCompartment.current.of(language),
      syntaxHighlighting(variableHighlightStyle),
      
      // Theme
      baseTheme,
      
      // Update listener
      EditorView.updateListener.of(handleUpdate),
      
      // Line wrapping (unless single line)
      ...(singleLine ? [] : [EditorView.lineWrapping]),
      
      // Placeholder
      ...(placeholder ? [placeholderExt(placeholder)] : []),
    ]
    
    const state = EditorState.create({
      doc: value,
      extensions,
    })
    
    const view = new EditorView({
      state,
      parent: containerRef.current,
    })
    
    viewRef.current = view
    
    return () => {
      view.destroy()
      viewRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Only run on mount
  
  // Sync external value changes
  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    
    const currentValue = view.state.doc.toString()
    if (currentValue !== value) {
      view.dispatch({
        changes: {
          from: 0,
          to: currentValue.length,
          insert: value,
        },
      })
    }
  }, [value])
  
  // Update language when variableKeys change
  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    
    const language = createTemplateLanguage(validKeysSet)
    view.dispatch({
      effects: languageCompartment.current.reconfigure(language),
    })
  }, [validKeysSet])
  
  return (
    <div
      id={id}
      ref={containerRef}
      className={cn(
        'rounded-md border border-input bg-background',
        'focus-within:ring-1 focus-within:ring-ring/50',
        'overflow-hidden',
        className
      )}
      style={{ 
        minHeight: singleLine ? undefined : minHeight,
        maxHeight: singleLine ? '42px' : undefined,
      }}
    />
  )
}

// =============================================================================
// Single Line Variant
// =============================================================================

interface TemplateInputProps {
  /** Current value */
  value: string
  /** Change handler */
  onChange: (value: string) => void
  /** Placeholder text */
  placeholder?: string
  /** Valid variable keys for highlighting */
  variableKeys: string[]
  /** Additional CSS classes */
  className?: string
  /** HTML id */
  id?: string
}

/**
 * Single-line template input with variable highlighting
 * Use this for subject lines or short text fields
 */
export function TemplateInput({
  value,
  onChange,
  placeholder,
  variableKeys,
  className,
  id,
}: TemplateInputProps) {
  return (
    <TemplateEditor
      id={id}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      variableKeys={variableKeys}
      className={cn('h-10', className)}
      singleLine
      minHeight="40px"
    />
  )
}
