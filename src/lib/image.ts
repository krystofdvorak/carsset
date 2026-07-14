import imageCompression from 'browser-image-compression'
import type { PhotoKind } from './types'

// Doklady necháme ostřejší (čitelnost), fotky auta můžou být menší.
function optionsFor(kind: PhotoKind) {
  const isDoc = kind !== 'car'
  return {
    maxSizeMB: isDoc ? 0.6 : 0.4,
    maxWidthOrHeight: isDoc ? 2000 : 1600,
    initialQuality: isDoc ? 0.8 : 0.7,
    useWebWorker: true,
    fileType: 'image/jpeg' as const,
  }
}

export async function compressPhoto(file: File, kind: PhotoKind): Promise<Blob> {
  try {
    return await imageCompression(file, optionsFor(kind))
  } catch (e) {
    console.warn('Komprese selhala, ukládám originál', e)
    return file
  }
}
