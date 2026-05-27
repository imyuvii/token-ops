import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export type AppRole = "admin" | "manager" | "engineer" | "viewer";

export type AppSession = {
  name: string;
  email: string;
  role: AppRole;
  team: string;
};

const SESSION_COOKIE = "tokenops_session";

function encodeSession(session: AppSession): string {
  return Buffer.from(JSON.stringify(session), "utf8").toString("base64url");
}

function decodeSession(value: string): AppSession | null {
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as AppSession;
    if (!parsed?.email || !parsed?.role) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export async function getSession(): Promise<AppSession | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(SESSION_COOKIE)?.value;
  return raw ? decodeSession(raw) : null;
}

export async function requireSession(options?: { roles?: AppRole[] }): Promise<AppSession> {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }
  if (options?.roles && !options.roles.includes(session.role)) {
    redirect("/");
  }
  return session;
}

export async function createSessionCookie(session: AppSession) {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, encodeSession(session), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 8,
  });
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

export const demoUsers: AppSession[] = [
  {
    name: "Avery Shah",
    email: "avery@acme.ai",
    role: "admin",
    team: "Platform",
  },
  {
    name: "Maya Chen",
    email: "maya@acme.ai",
    role: "manager",
    team: "Revenue Systems",
  },
  {
    name: "Nina Patel",
    email: "nina@acme.ai",
    role: "engineer",
    team: "Customer Ops",
  },
  {
    name: "Leo Kim",
    email: "leo@acme.ai",
    role: "viewer",
    team: "Finance",
  },
];

