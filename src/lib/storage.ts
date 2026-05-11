import { promises as fs } from "fs";import path from "path";import type { AppData } from "@/types/tnb";
const dataDir=path.join(process.cwd(),"data");const dataFile=path.join(dataDir,"tnb-herren.json");
export async function saveData(data:AppData){await fs.mkdir(dataDir,{recursive:true});await fs.writeFile(dataFile,JSON.stringify(data,null,2),"utf8")}
export async function loadData():Promise<AppData>{try{return JSON.parse(await fs.readFile(dataFile,"utf8")) as AppData}catch{return{generatedAt:new Date().toISOString(),championship:"TNB Sommer 2026",sourcePages:[],groupCount:0,teamCount:0,teams:[],warnings:["Noch keine Daten vorhanden. Bitte zuerst npm run refresh ausführen."]}}}
