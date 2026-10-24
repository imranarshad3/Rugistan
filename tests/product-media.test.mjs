import test from 'node:test'
import assert from 'node:assert/strict'
import { isVideoMedia, validateProductMedia } from '../src/lib/productMedia.ts'
test('detects supported video URLs including query strings', () => {
  assert.equal(isVideoMedia('https://example.com/a.MP4?token=x'), true)
  assert.equal(isVideoMedia('/products/a.webm'), true)
  assert.equal(isVideoMedia('/products/a.webp'), false)
})
test('enforces separate photo and video size limits', () => {
  const file = (type, mb) => ({ name: 'media', type, size: mb * 1024 * 1024 })
  assert.equal(validateProductMedia(file('image/jpeg', 8)), null)
  assert.match(validateProductMedia(file('image/jpeg', 9)), /8 MB/)
  assert.equal(validateProductMedia(file('video/mp4', 50)), null)
  assert.match(validateProductMedia(file('video/webm', 51)), /50 MB/)
  assert.match(validateProductMedia(file('application/pdf', 1)), /use JPG/)
})
