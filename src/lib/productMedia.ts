export const PRODUCT_MEDIA_ACCEPT = 'image/jpeg,image/png,image/webp,image/avif,video/mp4,video/webm'
export const isVideoMedia = (url: string) => /\.(mp4|webm)(?:[?#]|$)/i.test(url)
export function validateProductMedia(file: Pick<File, 'name' | 'type' | 'size'>) {
  const video = ['video/mp4', 'video/webm'].includes(file.type)
  if (!PRODUCT_MEDIA_ACCEPT.split(',').includes(file.type)) return `${file.name}: use JPG, PNG, WebP, AVIF, MP4 or WebM.`
  const limit = video ? 50 : 8
  return file.size > limit * 1024 * 1024 ? `${file.name}: maximum ${limit} MB per ${video ? 'video' : 'photo'}.` : null
}
