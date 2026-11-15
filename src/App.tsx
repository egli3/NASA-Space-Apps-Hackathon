/**
 * App shell + screen router. Owner: Track C.
 * No URL router: `screen` in the store is the router (GitHub Pages friendly). Each screen sets one of three
 * visual moods on <html>; see src/index.css.
 */
import { useLayoutEffect } from 'react';
import { MotionConfig } from 'motion/react';
import { useGame, type Screen } from './store/game';
import { Briefing } from './ui/screens/Briefing';
import { Credits } from './ui/screens/Credits';
import { Debrief } from './ui/screens/Debrief';
import { DesignStudio } from './ui/screens/DesignStudio';
import { Flight } from './ui/screens/Flight';
import { Launch } from './ui/screens/Launch';
import { RealityCheck } from './ui/screens/RealityCheck';
import { ReviewBoard } from './ui/screens/ReviewBoard';
import { ScenarioSelect } from './ui/screens/ScenarioSelect';
import { Title } from './ui/screens/Title';

type Mood = 'blueprint' | 'control' | 'report';
const MOOD: Partial<Record<Screen, Mood>> = { flight: 'control', debrief: 'report' };

/** Screens that need a design in the store. If it is missing (e.g. after a hot reload), fall back to the title. */
const NEEDS_DESIGN: Screen[] = ['briefing', 'design', 'launch', 'review', 'growth', 'flight', 'debrief'];

function CurrentScreen({ screen }: { screen: Screen }) {
  switch (screen) {
    case 'title':
      return <Title />;
    case 'scenario':
      return <ScenarioSelect />;
    case 'briefing':
      return <Briefing />;
    case 'design':
      return <DesignStudio />;
    case 'launch':
      return <Launch />;
    case 'review':
      return <ReviewBoard />;
    case 'growth':
      return <RealityCheck />;
    case 'flight':
      return <Flight />;
    case 'debrief':
      return <Debrief />;
    case 'credits':
      return <Credits />;
  }
}

export default function App() {
  const stored = useGame((s) => s.screen);
  const hasDesign = useGame((s) => s.design !== undefined);
  const seed = useGame((s) => s.seed);
  const screen: Screen = NEEDS_DESIGN.includes(stored) && !hasDesign ? 'title' : stored;

  useLayoutEffect(() => {
    document.documentElement.dataset.mood = MOOD[screen] ?? 'blueprint';
  }, [screen]);

  return (
    <MotionConfig reducedMotion="user">
      {/* keyed so each screen (and each new flight) mounts fresh */}
      <CurrentScreen key={`${screen}-${screen === 'flight' ? seed : ''}`} screen={screen} />
    </MotionConfig>
  );
}
