import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'

interface SignaturePadProps {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
}

const WIDTH = 640
const HEIGHT = 200

export function SignaturePad({
  value,
  onChange,
  disabled = false,
}: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const drawingRef = useRef(false)
  const lastPointRef = useRef({ x: 0, y: 0 })
  const [dirty, setDirty] = useState(Boolean(value))

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const context = canvas.getContext('2d')
    if (!context) return

    context.fillStyle = '#fffdf7'
    context.fillRect(0, 0, WIDTH, HEIGHT)
    context.lineWidth = 2.4
    context.lineCap = 'round'
    context.lineJoin = 'round'
    context.strokeStyle = '#0d2136'

    if (!value) {
      setDirty(false)
      return
    }

    const image = new Image()
    image.onload = () => {
      context.fillStyle = '#fffdf7'
      context.fillRect(0, 0, WIDTH, HEIGHT)
      context.drawImage(image, 0, 0, WIDTH, HEIGHT)
      setDirty(true)
    }
    image.src = value
  }, [value])

  const getPoint = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    return {
      x: ((event.clientX - rect.left) / rect.width) * WIDTH,
      y: ((event.clientY - rect.top) / rect.height) * HEIGHT,
    }
  }

  const startStroke = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (disabled) return

    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (!canvas || !context) return

    drawingRef.current = true
    const point = getPoint(event)
    lastPointRef.current = point
    context.beginPath()
    context.moveTo(point.x, point.y)
    canvas.setPointerCapture(event.pointerId)
  }

  const drawStroke = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (disabled || !drawingRef.current) return

    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (!canvas || !context) return

    const point = getPoint(event)
    context.beginPath()
    context.moveTo(lastPointRef.current.x, lastPointRef.current.y)
    context.lineTo(point.x, point.y)
    context.stroke()
    lastPointRef.current = point
    setDirty(true)
  }

  const endStroke = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (disabled) return

    drawingRef.current = false
    event.currentTarget.releasePointerCapture(event.pointerId)
    const canvas = canvasRef.current
    if (!canvas) return

    onChange(canvas.toDataURL('image/png'))
  }

  const clearCanvas = () => {
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (!canvas || !context) return

    context.fillStyle = '#fffdf7'
    context.fillRect(0, 0, WIDTH, HEIGHT)
    onChange('')
    setDirty(false)
  }

  return (
    <div className="signature-pad">
      <canvas
        ref={canvasRef}
        width={WIDTH}
        height={HEIGHT}
        className={`signature-canvas${disabled ? ' is-disabled' : ''}`}
        onPointerDown={startStroke}
        onPointerMove={drawStroke}
        onPointerUp={endStroke}
        onPointerLeave={(event) => {
          if (drawingRef.current) {
            endStroke(event)
          }
        }}
      />
      <div className="signature-actions">
        <span>{dirty ? 'Signature captured' : 'Draw customer signature here'}</span>
        <button
          type="button"
          className="ghost-button"
          onClick={clearCanvas}
          disabled={disabled || !dirty}
        >
          Clear
        </button>
      </div>
    </div>
  )
}
