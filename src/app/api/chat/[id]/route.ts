import { CHAT_ID, deleteChat } from "@/lib/chats";

export const runtime = "nodejs";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!CHAT_ID.test(id)) return Response.json({ error: "Unknown chat." }, { status: 404 });
  await deleteChat(id);
  return Response.json({ ok: true });
}
