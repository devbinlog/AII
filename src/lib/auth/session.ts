"use server";

import { cookies } from "next/headers";
import { getRepository } from "@/lib/repository";
import type { Session, User } from "@/types";

const COOKIE_NAME = "aii_session";
const COOKIE_MAX_AGE = 7 * 24 * 60 * 60; // 7 days

export async function getSession(): Promise<Session | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  const repo = getRepository();
  const session = await repo.auth.getSession(token);
  if (!session) return null;
  if (new Date(session.expiresAt) < new Date()) return null;
  return session;
}

export async function getCurrentUser(): Promise<User | null> {
  const session = await getSession();
  if (!session) return null;
  const repo = getRepository();
  return repo.auth.getUser(session.userId);
}

export async function requireAuth(): Promise<{ session: Session; user: User }> {
  const session = await getSession();
  if (!session) throw new Error("UNAUTHORIZED");
  const repo = getRepository();
  const user = await repo.auth.getUser(session.userId);
  if (!user) throw new Error("UNAUTHORIZED");
  return { session, user };
}

export async function setSessionCookie(token: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: COOKIE_MAX_AGE,
    path: "/",
  });
}

export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

