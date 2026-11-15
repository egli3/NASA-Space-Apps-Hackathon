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
        <div className="min-h-0 min-w-0 lg:grid lg:grid-rows-[minmax(230px,42%)_minmax(0,1fr)]">
          <div data-coach="schematic" className="min-h-0 border-b border-line lg:flex lg:flex-col">
            <div className="relative h-44 sm:h-56 lg:h-auto lg:min-h-0 lg:flex-1">
              <div className="absolute inset-0 px-3 pt-2">
                <SpacecraftSchematic design={design} budgets={budgets} />
              </div>
            </div>
            {/* Room for two rows of chips, so the sketch does not jump when a change ripples a long way. */}
            <div className="px-3 pb-2 lg:flex lg:min-h-[5.25rem] lg:items-end lg:px-4 2xl:min-h-11">
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
