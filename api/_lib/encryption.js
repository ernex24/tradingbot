// AES-256-GCM application-level encryption for at-rest secrets.
// The key lives in the ENCRYPTION_KEY env var (32-byte hex). Plaintext
// API keys/secrets never reach the DB.
//
// Ciphertext format: <iv_hex>:<ciphertext_hex>:<auth_tag_hex>

import crypto from 'node:crypto'

const ALGO = 'aes-256-gcm'
const IV_LEN = 12 // 96 bits, GCM standard
const TAG_LEN = 16

function getKey() {
  const raw = process.env.ENCRYPTION_KEY
  if (!raw) throw new Error('ENCRYPTION_KEY env var is not set')
  const key = Buffer.from(raw, 'hex')
  if (key.length !== 32) {
    throw new Error('ENCRYPTION_KEY must be 32 bytes (64 hex chars)')
  }
  return key
}

export function encrypt(plaintext) {
  const key = getKey()
  const iv = crypto.randomBytes(IV_LEN)
  const cipher = crypto.createCipheriv(ALGO, key, iv)
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ])
  const tag = cipher.getAuthTag()
  return `${iv.toString('hex')}:${ciphertext.toString('hex')}:${tag.toString('hex')}`
}

export function decrypt(payload) {
  const key = getKey()
  const parts = payload.split(':')
  if (parts.length !== 3) throw new Error('malformed ciphertext')
  const [ivHex, ctHex, tagHex] = parts
  const iv = Buffer.from(ivHex, 'hex')
  const ciphertext = Buffer.from(ctHex, 'hex')
  const tag = Buffer.from(tagHex, 'hex')
  if (iv.length !== IV_LEN) throw new Error('invalid IV length')
  if (tag.length !== TAG_LEN) throw new Error('invalid tag length')
  const decipher = crypto.createDecipheriv(ALGO, key, iv)
  decipher.setAuthTag(tag)
  const plaintext = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ])
  return plaintext.toString('utf8')
}
