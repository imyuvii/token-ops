import { redirect } from "next/navigation";

import { createSessionCookie, demoUsers, getSession } from "@/lib/auth";

async function loginAction(formData: FormData) {
  "use server";

  const email = String(formData.get("email") ?? "");
  const user = demoUsers.find((entry) => entry.email === email);
  if (!user) {
    redirect("/login?error=1");
  }

  await createSessionCookie(user);
  redirect("/");
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getSession();
  if (session) {
    redirect("/");
  }

  const params = (await searchParams) ?? {};
  const hasError = params.error === "1";

  return (
    <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top_left,_rgba(125,211,252,0.11),_transparent_28%),radial-gradient(circle_at_bottom_right,_rgba(251,146,60,0.14),_transparent_24%),linear-gradient(180deg,_#09111d_0%,_#060b14_100%)] px-4 text-slate-100">
      <section className="w-full max-w-md rounded-[32px] border border-white/8 bg-white/5 p-6 backdrop-blur-xl">
        <p className="text-sm uppercase tracking-[0.24em] text-slate-400">TokenOps access</p>
        <h1 className="mt-3 font-space-grotesk text-4xl font-semibold text-white">
          Sign in to the control plane
        </h1>
        <p className="mt-3 text-sm text-slate-300">
          Use a seeded demo identity to enter the local environment.
        </p>

        <form action={loginAction} className="mt-6 space-y-3">
          <select
            name="email"
            className="w-full rounded-2xl border border-white/10 bg-white/6 px-3 py-3 text-sm text-slate-100 outline-none"
            defaultValue={demoUsers[0].email}
          >
            {demoUsers.map((user) => (
              <option key={user.email} value={user.email} className="bg-slate-900">
                {user.name} • {user.role} • {user.team}
              </option>
            ))}
          </select>
          {hasError ? <p className="text-sm text-rose-300">Unable to sign in with that user.</p> : null}
          <button
            type="submit"
            className="w-full rounded-2xl bg-white px-4 py-3 font-medium text-slate-950 transition hover:bg-slate-100"
          >
            Continue
          </button>
        </form>
      </section>
    </main>
  );
}

