import { redirect } from "next/navigation";

export default async function DocRedirectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/docs?open=${id}`);
}
