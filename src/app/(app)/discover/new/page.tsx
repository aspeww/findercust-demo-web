import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { NewSearchForm } from "./_components/new-search-form";

export default async function NewSearchPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <div className="mx-auto max-w-3xl">
      <NewSearchForm />
    </div>
  );
}
