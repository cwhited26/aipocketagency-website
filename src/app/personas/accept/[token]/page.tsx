import AcceptClient from "./AcceptClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "Accept invite — Pocket Agent" };

export default function AcceptPage({ params }: { params: { token: string } }) {
  return <AcceptClient token={params.token} />;
}
