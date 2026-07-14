import { useEffect, useRef, useImperativeHandle, forwardRef } from 'react'
import SignaturePadLib from 'signature_pad'

export interface SignaturePadHandle {
  clear: () => void
  isEmpty: () => boolean
  toDataURL: () => string
}

export const SignaturePad = forwardRef<SignaturePadHandle, { onChange?: (empty: boolean) => void }>(
  function SignaturePad({ onChange }, ref) {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const padRef = useRef<SignaturePadLib | null>(null)

    useEffect(() => {
      const canvas = canvasRef.current!
      const pad = new SignaturePadLib(canvas, {
        penColor: '#111827',
        backgroundColor: 'rgba(255,255,255,1)',
        minWidth: 1.1,
        maxWidth: 3.2,
      })
      padRef.current = pad

      const resize = () => {
        const ratio = Math.max(window.devicePixelRatio || 1, 1)
        const rect = canvas.getBoundingClientRect()
        const data = pad.toData()
        canvas.width = rect.width * ratio
        canvas.height = rect.height * ratio
        canvas.getContext('2d')!.scale(ratio, ratio)
        pad.clear()
        if (data.length) pad.fromData(data)
      }
      resize()
      window.addEventListener('resize', resize)
      pad.addEventListener('endStroke', () => onChange?.(pad.isEmpty()))
      return () => {
        window.removeEventListener('resize', resize)
        pad.off()
      }
    }, [onChange])

    useImperativeHandle(ref, () => ({
      clear: () => { padRef.current?.clear(); onChange?.(true) },
      isEmpty: () => padRef.current?.isEmpty() ?? true,
      toDataURL: () => padRef.current?.toDataURL('image/png') ?? '',
    }))

    return (
      <div className="sigwrap">
        <canvas ref={canvasRef} className="sigcanvas" />
        <div className="sighint">Podepište se prstem</div>
      </div>
    )
  }
)
