import { renderFloatingTerminalPanelSurface } from './FloatingTerminalPanelSurface'
import type { FloatingTerminalPanelProps } from './floating-terminal-panel-types'
import { useFloatingTerminalPanelController } from './use-floating-terminal-panel-controller'
import { useFloatingPanelTerminalMountTabIds } from '../manager-agent/use-floating-panel-terminal-mounts'

export { FloatingTerminalToggleButton } from './FloatingTerminalToggleButton'
export { clearReportedFloatingFocusCache } from './floating-terminal-focus-reporting'

export function FloatingTerminalPanel(props: FloatingTerminalPanelProps): React.JSX.Element {
  const surface = useFloatingTerminalPanelController(props)
  const terminalMountTabIds = useFloatingPanelTerminalMountTabIds()
  return renderFloatingTerminalPanelSurface({ ...surface, terminalMountTabIds })
}
