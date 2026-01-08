import { memo } from 'react'
import type { RelationshipKind } from '@/types'

interface GraphEdgeProps {
  id: string
  sourceX: number
  sourceY: number
  targetX: number
  targetY: number
  kind: RelationshipKind
  isHighlighted?: boolean
  isFaded?: boolean
}

const kindColors: Record<RelationshipKind, { stroke: string; opacity: number }> = {
  imports: { stroke: 'stroke-cyan-500', opacity: 0.6 },
  exports: { stroke: 'stroke-emerald-500', opacity: 0.5 },
  calls: { stroke: 'stroke-violet-500', opacity: 0.5 },
  extends: { stroke: 'stroke-amber-500', opacity: 0.5 },
  implements: { stroke: 'stroke-amber-500', opacity: 0.5 },
  references: { stroke: 'stroke-zinc-500', opacity: 0.4 },
  contains: { stroke: 'stroke-zinc-600', opacity: 0.3 },
}

export const GraphEdge = memo(function GraphEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  kind,
  isHighlighted = false,
  isFaded = false,
}: GraphEdgeProps) {
  const colors = kindColors[kind] || kindColors.imports

  // Calculate arrow head position
  const dx = targetX - sourceX
  const dy = targetY - sourceY
  const length = Math.sqrt(dx * dx + dy * dy)

  // Avoid division by zero
  if (length === 0) return null

  const unitX = dx / length
  const unitY = dy / length

  // Shorten line to not overlap with nodes
  const shortenBy = 25
  const adjustedSourceX = sourceX + unitX * shortenBy
  const adjustedSourceY = sourceY + unitY * shortenBy
  const adjustedTargetX = targetX - unitX * shortenBy
  const adjustedTargetY = targetY - unitY * shortenBy

  // Arrow head
  const arrowSize = 6
  const arrowAngle = Math.PI / 6
  const angle = Math.atan2(dy, dx)
  const arrow1X = adjustedTargetX - arrowSize * Math.cos(angle - arrowAngle)
  const arrow1Y = adjustedTargetY - arrowSize * Math.sin(angle - arrowAngle)
  const arrow2X = adjustedTargetX - arrowSize * Math.cos(angle + arrowAngle)
  const arrow2Y = adjustedTargetY - arrowSize * Math.sin(angle + arrowAngle)

  const opacity = isFaded ? 0.1 : isHighlighted ? 1 : colors.opacity
  const strokeWidth = isHighlighted ? 2 : 1

  // Get fill color from stroke class
  const fillClass = colors.stroke.replace('stroke-', 'fill-')

  return (
    <g
      className="transition-opacity duration-200"
      opacity={isFaded ? 0.2 : 1}
      data-testid={`graph-edge-${id}`}
    >
      {/* Glow effect for highlighted edges */}
      {isHighlighted && (
        <line
          x1={adjustedSourceX}
          y1={adjustedSourceY}
          x2={adjustedTargetX}
          y2={adjustedTargetY}
          className={colors.stroke}
          strokeWidth={4}
          strokeOpacity={0.2}
          strokeLinecap="round"
        />
      )}

      {/* Main line */}
      <line
        x1={adjustedSourceX}
        y1={adjustedSourceY}
        x2={adjustedTargetX}
        y2={adjustedTargetY}
        className={colors.stroke}
        strokeWidth={strokeWidth}
        strokeOpacity={opacity}
        strokeLinecap="round"
      />

      {/* Arrow head */}
      <polygon
        points={`${adjustedTargetX},${adjustedTargetY} ${arrow1X},${arrow1Y} ${arrow2X},${arrow2Y}`}
        className={fillClass}
        fillOpacity={opacity}
      />
    </g>
  )
})
