import { describe, it, expect } from 'vitest'
import { tourForRoute, shouldShowIntro } from './tours'

describe('shouldShowIntro', () => {
  it('true when welcome_video not seen', () => {
    expect(shouldShowIntro({})).toBe(true)
  })
  it('false once welcome_video is done', () => {
    expect(shouldShowIntro({ welcome_video: true })).toBe(false)
  })
})

describe('tourForRoute /app intro gating', () => {
  it('no tour while intro video is pending', () => {
    expect(tourForRoute('/app', {})).toBeNull()
  })
  it('welcome fires after intro video is seen', () => {
    expect(tourForRoute('/app', { welcome_video: true })).toBe('welcome')
  })
  it('no /app tour once welcome is done (new_post tour removed)', () => {
    expect(tourForRoute('/app', { welcome_video: true, welcome: true })).toBeNull()
  })
  it('other routes are unaffected by welcome_video', () => {
    expect(tourForRoute('/app/voices', {})).toBe('voices')
  })
})
