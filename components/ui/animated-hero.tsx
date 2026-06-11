'use client'
import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { MoveRight, Play } from 'lucide-react'
import { Button } from '@/components/ui/button'

// Centered hero with a vertically-rotating headline word, recolored + recopied for
// Outloud. Reusable; the live landing hero composes this idea inside the lamp.
function AnimatedHero() {
  const [titleNumber, setTitleNumber] = useState(0)
  const titles = useMemo(() => ['actually you', 'scroll-stopping', 'never generic', 'build-in-public', 'ready to ship'], [])

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setTitleNumber(titleNumber === titles.length - 1 ? 0 : titleNumber + 1)
    }, 2000)
    return () => clearTimeout(timeoutId)
  }, [titleNumber, titles])

  return (
    <div className="w-full">
      <div className="mx-auto max-w-container-max px-margin-mobile md:px-margin-desktop">
        <div className="flex flex-col items-center justify-center gap-8 py-20 lg:py-32">
          <Button variant="secondary" size="sm" className="gap-3" asChild>
            <a href="#features">
              See what you get <MoveRight className="h-4 w-4" />
            </a>
          </Button>
          <div className="flex flex-col gap-4">
            <h1 className="max-w-2xl text-center font-headline-xl text-headline-xl leading-tight">
              <span>Your posts, but</span>
              <span className="relative flex w-full justify-center overflow-hidden text-center md:pb-4 md:pt-1">
                &nbsp;
                {titles.map((title, index) => (
                  <motion.span
                    key={index}
                    className="absolute bg-gradient-to-r from-electric-indigo to-secondary bg-clip-text font-bold text-transparent"
                    initial={{ opacity: 0, y: '-100' }}
                    transition={{ type: 'spring', stiffness: 50 }}
                    animate={
                      titleNumber === index
                        ? { y: 0, opacity: 1 }
                        : { y: titleNumber > index ? -150 : 150, opacity: 0 }
                    }
                  >
                    {title}
                  </motion.span>
                ))}
              </span>
            </h1>
            <p className="max-w-2xl text-center font-body-md text-body-md text-on-surface-variant">
              Stop the generic AI slop. Outloud captures how you actually write and turns your commits and build logs into high-signal posts and replies.
            </p>
          </div>
          <div className="flex flex-row gap-3">
            <Button size="lg" variant="outline" className="gap-3" asChild>
              <a href="#examples">
                See it work <Play className="h-4 w-4" />
              </a>
            </Button>
            <Button size="lg" className="gap-3" asChild>
              <a href="/signup">
                Get started <MoveRight className="h-4 w-4" />
              </a>
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

export { AnimatedHero }
