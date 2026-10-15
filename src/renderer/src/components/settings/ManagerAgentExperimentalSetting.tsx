import type { GlobalSettings } from '../../../../shared/global-settings-types'
import { translate } from '@/i18n/i18n'
import { Label } from '../ui/label'
import { SearchableSetting } from './SearchableSetting'
import { resolveManagerAgentSurface } from '../../../../shared/agent-oversight-experimental-settings'
import { SettingsSegmentedControl, SettingsSwitch } from './SettingsFormControls'
import { getExperimentalSearchEntry } from './experimental-search'

type ManagerAgentExperimentalSettingProps = {
  settings: GlobalSettings
  updateSettings: (updates: Partial<GlobalSettings>) => void
}

export function ManagerAgentExperimentalSetting({
  settings,
  updateSettings
}: ManagerAgentExperimentalSettingProps): React.JSX.Element {
  const managerAgentEnabled = settings.experimentalManagerAgent === true
  const surface = resolveManagerAgentSurface(settings)

  return (
    <SearchableSetting
      title={translate('auto.components.settings.ExperimentalPane.managerAgent.title', 'Manager')}
      description={translate(
        'auto.components.settings.ExperimentalPane.managerAgent.description',
        'One persistent agent that finds work across projects and delegates it to other agents.'
      )}
      keywords={getExperimentalSearchEntry().managerAgent.keywords}
      className="space-y-3 py-2"
      id="experimental-manager-agent"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 shrink space-y-0.5">
          <Label>
            {translate('auto.components.settings.ExperimentalPane.managerAgent.title', 'Manager')}
          </Label>
          <p className="text-xs text-muted-foreground">
            {translate(
              'auto.components.settings.ExperimentalPane.managerAgent.copy',
              'Adds a Manager page to the sidebar and command palette. The Manager is one persistent agent that looks across your projects, starts other agents through orchestration, and reports their results. Works best with the orchestration skill installed.'
            )}
          </p>
        </div>
        <SettingsSwitch
          checked={managerAgentEnabled}
          ariaLabel={translate(
            'auto.components.settings.ExperimentalPane.managerAgent.toggleLabel',
            'Toggle Manager'
          )}
          onChange={() =>
            updateSettings({
              experimentalManagerAgent: !managerAgentEnabled
            })
          }
        />
      </div>
      {managerAgentEnabled ? (
        <div className="ml-4 space-y-3 border-l border-border pl-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 shrink space-y-0.5">
              <Label>
                {translate(
                  'auto.components.settings.ExperimentalPane.managerAgent.surfaceLabel',
                  'Manager opens in'
                )}
              </Label>
              <p className="text-xs text-muted-foreground">
                {translate(
                  'auto.components.settings.ExperimentalPane.managerAgent.surfaceCopy',
                  "Terminal runs the agent's own CLI. Chat UI is opt-in. A running Manager keeps the surface it started with."
                )}
              </p>
            </div>
            <SettingsSegmentedControl
              value={surface}
              onChange={(next) => updateSettings({ managerAgentSurface: next })}
              ariaLabel={translate(
                'auto.components.settings.ExperimentalPane.managerAgent.surfaceAriaLabel',
                'Manager surface'
              )}
              size="sm"
              options={[
                {
                  value: 'terminal',
                  label: translate(
                    'auto.components.settings.ExperimentalPane.managerAgent.surfaceTerminal',
                    "Terminal (agent's own CLI)"
                  )
                },
                {
                  value: 'chat',
                  label: translate(
                    'auto.components.settings.ExperimentalPane.managerAgent.surfaceChat',
                    'Chat UI (opt-in)'
                  )
                }
              ]}
            />
          </div>
        </div>
      ) : null}
    </SearchableSetting>
  )
}
