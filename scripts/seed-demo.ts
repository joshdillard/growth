// Seeds the built-in demo reel into the queue so the editor can be explored
// before any API keys are configured.
import { demoReel } from "../remotion/demoReel";
import { saveReel, newId } from "../lib/store";

const reel = { ...demoReel, id: newId() };
saveReel(reel).then(() => console.log(`Seeded demo reel ${reel.id}`));
