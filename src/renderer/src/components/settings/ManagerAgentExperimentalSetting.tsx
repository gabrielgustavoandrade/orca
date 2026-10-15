import type { GlobalSettings } from '../../../../shared/global-settings-types'
import { translate } from '@/i18n/i18n'
import { Label } from '../ui/label'
import { SearchableSetting } from './SearchableSetting'
import { SettingsSwitch } from './SettingsFormControls'
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

  return (
    <SearchableSetting
      title={translate('auto.components.settings.ExperimentalPane.managerAgent.title', 'Manager')}
      description={translate(
        'auto.components.settings.ExperimentalPane.managerAgent.description',
        'One persistent chat that finds work across projects and delegates it to other agents.'
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
              'Adds a Manager entry to the sidebar and command palette. The Manager is one persistent chat in the floating workspace that looks across your projects, starts other agents through orchestration, and reports their results. Works best with Chat UI on and the orchestration skill installed.'
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
    </SearchableSetting>
  )
}
