import { useMemo, useRef } from 'react';
import { catalog } from '../../data';
import { engine } from '../../engine';
import { useGame } from '../../store/game';
import { Button } from '../common/Button';
import { ActionBar, Sheet } from '../common/Sheet';
import { BudgetPanel } from '../design/BudgetPanel';
import { CoachMarks } from '../design/CoachMarks';
import { OptionsPanel, SlotRail } from '../design/PartPicker';
import { RippleChips } from '../design/RippleChips';
import { SpacecraftSchematic } from '../design/SpacecraftSchematic';

export function DesignStudio() {
  const design = useGame((s) => s.design)!;
  const go = useGame((s) => s.go);
  const budgetPanel = useRef<HTMLElement>(null);
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
      <div className="scroll-quiet h-full overflow-y-auto lg:grid lg:grid-cols-[minmax(0,1fr)_360px] lg:overflow-hidden xl:grid-cols-[minmax(0,1fr)_400px]">
        <div className="min-h-0 min-w-0 lg:grid lg:grid-rows-[minmax(200px,38%)_minmax(0,1fr)]">
          <div data-coach="schematic" className="relative min-h-0 border-b border-line">
            <div className="h-44 px-3 pt-2 sm:h-56 lg:absolute lg:inset-0 lg:h-auto lg:pb-12">
              <SpacecraftSchematic design={design} budgets={budgets} />
            </div>
            <div className="px-3 pb-2 lg:absolute lg:right-4 lg:bottom-2 lg:left-4 lg:p-0">
              <RippleChips design={design} budgets={budgets} />
            </div>
          </div>
          <div className="flex justify-end border-b border-line px-4 lg:hidden">
            <Button variant="quiet" className="min-h-11" onClick={() => {
              budgetPanel.current?.scrollIntoView({ block: 'start' });
              budgetPanel.current?.focus({ preventScroll: true });
            }}>
              View budgets
            </Button>
          </div>
          <div data-coach="parts" className="min-h-0 min-w-0 md:grid md:grid-cols-[190px_minmax(0,1fr)] xl:grid-cols-[220px_minmax(0,1fr)]">
            <SlotRail design={design} />
            <OptionsPanel design={design} />
          </div>
        </div>
        <aside ref={budgetPanel} data-coach="budgets" aria-label="Budgets" tabIndex={-1} className="scroll-quiet min-h-0 min-w-0 border-t border-line bg-panel/85 lg:overflow-y-auto lg:border-t-0 lg:border-l">
          <BudgetPanel design={design} budgets={budgets} />
        </aside>
      </div>
      <CoachMarks />
    </Sheet>
  );
}
