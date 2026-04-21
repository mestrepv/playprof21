/**
 * Placeholder da aba Desempenho. Dashboard detalhado chega em fase futura.
 */

import { Card } from '../../../components/ui/Card'
import { ChartIcon } from '../../../components/ui/icons'

export function PerformanceTab() {
  return (
    <Card padded>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 14,
          padding: 'var(--p21-sp-7) var(--p21-sp-4)',
          textAlign: 'center',
          color: 'var(--p21-ink-3)',
        }}
      >
        <span
          aria-hidden
          style={{
            width: 60,
            height: 60,
            borderRadius: 16,
            background: 'var(--p21-surface-2)',
            display: 'grid',
            placeItems: 'center',
            color: 'var(--p21-ink-4)',
          }}
        >
          <ChartIcon size={26} />
        </span>
        <h3 style={{ margin: 0, color: 'var(--p21-ink)', fontSize: 'var(--p21-text-md)' }}>
          Dashboard de desempenho — em breve
        </h3>
        <p style={{ margin: 0, maxWidth: 400, fontSize: 'var(--p21-text-sm)', lineHeight: 1.55 }}>
          Gráficos por aluno, evolução ao longo do tempo, dificuldades por atividade. Por enquanto,
          clique nos stat cards acima pra ver números agregados.
        </p>
      </div>
    </Card>
  )
}
