import { loadData } from "@/lib/storage";import { TnbDashboard } from "@/components/TnbDashboard";export default async function Page(){const data=await loadData();return <TnbDashboard data={data}/>;}
