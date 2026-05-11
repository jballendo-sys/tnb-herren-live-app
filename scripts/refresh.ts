import { scrapeTnbMen } from "../src/lib/scrape";import { saveData } from "../src/lib/storage";
function parseLimit(){const arg=process.argv.find(a=>a.startsWith("--limit="));if(!arg)return undefined;const v=Number(arg.split("=")[1]);return Number.isFinite(v)?v:undefined}
async function main(){const limit=parseLimit();console.log(limit?`Lade die ersten ${limit} TNB Herren Gruppen...`:"Lade alle TNB Herren Gruppen...");const data=await scrapeTnbMen({limit,concurrency:5});await saveData(data);console.log(`Fertig. Gruppen: ${data.groupCount}, Teams: ${data.teamCount}, Warnungen: ${data.warnings.length}`)}
main().catch(e=>{console.error(e);process.exit(1)});
