/**
 * Wrapper mínimo sobre react-katex.
 * `<Math display>{tex}</Math>` para bloco, `<Math>{tex}</Math>` para inline.
 */

import 'katex/dist/katex.min.css'
import { BlockMath, InlineMath } from 'react-katex'

interface Props {
  children: string
  display?: boolean
}

export function Math({ children, display = false }: Props) {
  return display ? <BlockMath math={children} /> : <InlineMath math={children} />
}
