/**
 * Prints the submission form's "NASA Data" and "Other Data" lists straight from src/data/sources.json,
 * so the game and the form can never disagree. Usage: npm run sources:md
 */
import sources from '../../src/data/sources.json' with { type: 'json' };

type S = { id: string; title: string; url: string; isNasa: boolean };
const list = sources as S[];

console.log('## NASA Data (Link Text — URL)');
for (const s of list.filter((x) => x.isNasa)) console.log(`- ${s.title} — ${s.url}`);
console.log('\n## Space Agency Partner & Other Data');
for (const s of list.filter((x) => !x.isNasa)) console.log(`- ${s.title} — ${s.url}`);
