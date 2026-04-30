import { PageHeader } from "@/components/app/page-header";
import { FinanceChat } from "@/components/chat/finance-chat";

export default function ChatPage() {
  return (
    <>
      <PageHeader
        eyebrow="Chat"
        title="Read-only finance analyst"
        description="Ask technical financial questions using @ scopes. The agent can query local normalized records but cannot place trades or move money."
      />
      <FinanceChat />
    </>
  );
}
