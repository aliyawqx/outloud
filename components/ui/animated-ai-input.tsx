'use client'

import { ArrowRight, Check, ChevronDown } from 'lucide-react'
import { useState, useRef, useCallback, useEffect } from 'react'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { motion, AnimatePresence } from 'framer-motion'

interface UseAutoResizeTextareaProps {
  minHeight: number
  maxHeight?: number
}

function useAutoResizeTextarea({ minHeight, maxHeight }: UseAutoResizeTextareaProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const adjustHeight = useCallback(
    (reset?: boolean) => {
      const textarea = textareaRef.current
      if (!textarea) return
      if (reset) {
        textarea.style.height = `${minHeight}px`
        return
      }
      textarea.style.height = `${minHeight}px`
      const newHeight = Math.max(minHeight, Math.min(textarea.scrollHeight, maxHeight ?? Number.POSITIVE_INFINITY))
      textarea.style.height = `${newHeight}px`
    },
    [minHeight, maxHeight],
  )

  useEffect(() => {
    const textarea = textareaRef.current
    if (textarea) textarea.style.height = `${minHeight}px`
  }, [minHeight])

  useEffect(() => {
    const handleResize = () => adjustHeight()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [adjustHeight])

  return { textareaRef, adjustHeight }
}

// Outloud's own choices in place of the AI-model picker.
const MODES = ['Post', 'Reply', 'Thread', 'Announcement', 'Quote post', '5 hooks']
const VOICES = ['Elen', 'Sam', 'Trung', 'Naval', 'You']

function Picker({
  icon,
  value,
  options,
  onSelect,
}: {
  icon: string
  value: string
  options: string[]
  onSelect: (v: string) => void
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 gap-1 rounded-md px-2 text-xs font-medium text-on-surface-variant hover:bg-white/[0.06] hover:text-on-surface"
        >
          <AnimatePresence mode="wait">
            <motion.span
              key={value}
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 5 }}
              transition={{ duration: 0.15 }}
              className="flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[16px] text-electric-indigo">{icon}</span>
              {value}
              <ChevronDown className="h-3 w-3 opacity-50" />
            </motion.span>
          </AnimatePresence>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="min-w-[10rem]">
        {options.map((opt) => (
          <DropdownMenuItem
            key={opt}
            onSelect={() => onSelect(opt)}
            className="flex items-center justify-between gap-2"
          >
            <span className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[16px] text-on-surface-variant">{icon}</span>
              {opt}
            </span>
            {value === opt && <Check className="h-4 w-4 text-electric-indigo" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function AI_Prompt() {
  const [value, setValue] = useState('')
  const { textareaRef, adjustHeight } = useAutoResizeTextarea({ minHeight: 72, maxHeight: 300 })
  const [mode, setMode] = useState('Post')
  const [voice, setVoice] = useState('Elen')

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && value.trim()) {
      e.preventDefault()
      setValue('')
      adjustHeight(true)
    }
  }

  return (
    <div className="w-full">
      <div className="rounded-2xl bg-white/[0.04] p-1.5">
        <div className="relative flex flex-col">
          <div className="overflow-y-auto" style={{ maxHeight: '400px' }}>
            <Textarea
              value={value}
              placeholder="what did you ship? type a rough idea…"
              className={cn(
                'w-full resize-none rounded-xl rounded-b-none border-none bg-white/[0.04] px-4 py-3 text-on-surface placeholder:text-on-surface-variant/60 focus-visible:ring-0 focus-visible:ring-offset-0',
                'min-h-[72px]',
              )}
              ref={textareaRef}
              onKeyDown={handleKeyDown}
              onChange={(e) => {
                setValue(e.target.value)
                adjustHeight()
              }}
            />
          </div>

          <div className="flex h-14 items-center rounded-b-xl bg-white/[0.04]">
            <div className="absolute bottom-3 left-3 right-3 flex w-[calc(100%-24px)] items-center justify-between">
              <div className="flex items-center gap-1">
                <Picker icon="category" value={mode} options={MODES} onSelect={setMode} />
                <div className="mx-0.5 h-4 w-px bg-white/10" />
                <Picker icon="graphic_eq" value={voice} options={VOICES} onSelect={setVoice} />
              </div>
              <button
                type="button"
                className="rounded-lg bg-electric-indigo p-2 transition-opacity disabled:bg-white/[0.06]"
                aria-label="Send"
                disabled={!value.trim()}
                onClick={() => {
                  if (!value.trim()) return
                  setValue('')
                  adjustHeight(true)
                }}
              >
                <ArrowRight className={cn('h-4 w-4 text-white transition-opacity', value.trim() ? 'opacity-100' : 'opacity-40')} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
