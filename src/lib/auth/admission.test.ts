import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { canAccessApp } from './admission.ts'

describe('canAccessApp', () => {
  it('allows active users', () => {
    assert.equal(canAccessApp({ isActive: true }), true)
  })

  it('blocks inactive users', () => {
    assert.equal(canAccessApp({ isActive: false }), false)
  })
})
