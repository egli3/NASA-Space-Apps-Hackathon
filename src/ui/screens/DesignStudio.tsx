import { useMemo } from 'react';
import { catalog } from '../../data';
import { engine } from '../../engine';
import { useGame } from '../../store/game';
import { ActionBar, Sheet } from '../common/Sheet';
import { BudgetPanel } from '../design/BudgetPanel';
import { OptionsPanel, SlotRail } from '../design/PartPicker';
import { RippleChips } from '../design/RippleChips';
import { SpacecraftSchematic } from '../design/SpacecraftSchematic';

export function DesignStudio() {
  const design = useGame((s) => s.design)!;
  const go = useGame((s) => s.go);
  // computeBudgets is fast (well under a millisecond), so it runs on every change.
  const budgets = useMemo(() => engine.computeBudgets(catalog, design), [design]);

  return (
    <Sheet
      actions={
        <ActionBar
          back={{ label: 'Briefing', onClick: () => go('briefing') }}
          primary={{ label: 'Choose a rocket and a route', onClick: () => go('launch') }}
          note={budgets.blockers.length > 0 ? 'You can keep going, but the review board will not pass a design that cannot fly.' : 'Nothing is final until the review board signs off.'}
        />
      }
    >
      <div className="grid h-full grid-cols-[minmax(0,1fr)_360px] xl:grid-cols-[minmax(0,1fr)_400px]">
        <div className="grid min-h-0 grid-rows-[minmax(200px,38%)_minmax(0,1fr)]">
          <div className="relative min-h-0 border-b border-line">
            <div className="absolute inset-0 px-3 pt-2 pb-11">
              <SpacecraftSchematic design={design} budgets={budgets} />
            </div>
            <div className="absolute right-4 bottom-2 left-4">
              <RippleChips design={design} budgets={budgets} />
            </div>
          </div>
          <div className="grid min-h-0 grid-cols-[190px_minmax(0,1fr)] xl:grid-cols-[220px_minmax(0,1fr)]">
            <SlotRail design={design} />
            <OptionsPanel design={design} />
          </div>
        </div>
        <aside aria-label="Budgets" className="scroll-quiet min-h-0 overflow-y-auto border-l border-line bg-panel/85">
          <BudgetPanel design={design} budgets={budgets} />
        </aside>
      </div>
    </Sheet>
  );
}
