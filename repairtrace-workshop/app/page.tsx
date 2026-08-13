import { headers } from "next/headers";
import { requireChatGPTUser } from "./chatgpt-auth";
import WorkshopDashboard from "./workshop-dashboard";

export const dynamic = "force-dynamic";

export default async function Home() {
  const requestHeaders = await headers();
  const host = requestHeaders.get("host") ?? "";
  if (!host.startsWith("terminal.local") && !host.startsWith("localhost") && !host.startsWith("127.0.0.1")) {
    await requireChatGPTUser("/");
  }
  return <WorkshopDashboard/>;
}
