import { clearSessionCookie } from "@/lib/auth";

export async function logoutAction() {
  "use server";
  await clearSessionCookie();
}

export function LogoutButton() {
  return (
    <form action={logoutAction}>
      <button
        type="submit"
        className="rounded-2xl border border-white/10 bg-white/6 px-4 py-2 text-sm text-slate-200 transition hover:bg-white/10"
      >
        Log out
      </button>
    </form>
  );
}

