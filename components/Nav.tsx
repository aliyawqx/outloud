'use client'

import { useEffect, useState } from 'react'
import { Logo } from './ui'

export function Nav() {
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 20)
    on()
    window.addEventListener('scroll', on, { passive: true })
    return () => window.removeEventListener('scroll', on)
  }, [])
  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        borderBottom: '1px solid ' + (scrolled ? 'var(--border)' : 'transparent'),
        background: scrolled ? 'color-mix(in oklab, var(--bg) 82%, transparent)' : 'transparent',
        backdropFilter: scrolled ? 'blur(12px)' : 'none',
        transition: 'background .3s, border-color .3s',
      }}
    >
      <div className="wrap row center between" style={{ height: 70 }}>
        <a href="#top" className="row center gap-12">
          <Logo />
        </a>
        <nav className="row center gap-24" style={{ fontSize: 14.5 }}>
          <a href="#how" className="dim mono" style={{ fontSize: 13.5 }}>
            how
          </a>
          <a href="#why" className="dim mono" style={{ fontSize: 13.5 }}>
            why us
          </a>
          <a href="#claim" className="btn btn--primary" style={{ padding: '10px 18px' }}>
            get early access
          </a>
        </nav>
      </div>
    </header>
  )
}
