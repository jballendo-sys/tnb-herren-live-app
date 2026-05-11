import { NextResponse } from "next/server";import { loadData } from "@/lib/storage";export async function GET(){return NextResponse.json(await loadData())}
