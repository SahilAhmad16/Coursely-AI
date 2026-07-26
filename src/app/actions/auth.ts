"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import type { AuthError } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

type AuthResult = { error?: string; message?: string };

function isConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
}

function stringField(formData: FormData, name: string) {
  return String(formData.get(name) ?? "").trim();
}

function emailAuthError(error: AuthError) {
  if (error.status === 429 || error.code === "over_email_send_rate_limit") {
    return "Too many verification emails have been requested. Please wait up to one hour, or continue with Google.";
  }
  if (error.code === "email_address_invalid") {
    return "This email address cannot be used. Enter another valid email address.";
  }
  if (error.code === "user_already_exists") {
    return "An account with this email already exists. Log in or reset your password.";
  }
  return "We could not create your account. Please try again.";
}

export async function signIn(_: AuthResult, formData: FormData): Promise<AuthResult> {
  if (!isConfigured()) return { error: "Coursely AI is still connecting its secure account service." };
  const email = stringField(formData, "email");
  const password = stringField(formData, "password");
  if (!email || !password) return { error: "Email and password are required." };
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: "Incorrect email or password." };
  redirect("/start");
}

export async function signUp(_: AuthResult, formData: FormData): Promise<AuthResult> {
  if (!isConfigured()) return { error: "Coursely AI is still connecting its secure account service." };
  const fullName = stringField(formData, "fullName");
  const email = stringField(formData, "email");
  const password = stringField(formData, "password");
  if (fullName.length < 2) return { error: "Enter your full name." };
  if (!/^\S+@\S+\.\S+$/.test(email)) return { error: "Enter a valid email address." };
  if (password.length < 10) return { error: "Use at least 10 characters for your password." };
  const origin = (await headers()).get("origin") ?? process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName }, emailRedirectTo: `${origin}/auth/callback?next=/start` },
  });
  if (error) return { error: emailAuthError(error) };
  if (data.session) redirect("/start");
  return { message: "Check your email to confirm your account." };
}

export async function requestPasswordReset(_: AuthResult, formData: FormData): Promise<AuthResult> {
  if (!isConfigured()) return { error: "Coursely AI is still connecting its secure account service." };
  const email = stringField(formData, "email");
  if (!/^\S+@\S+\.\S+$/.test(email)) return { error: "Enter a valid email address." };
  const origin = (await headers()).get("origin") ?? process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${origin}/auth/callback?next=/update-password` });
  if (error) return { error: emailAuthError(error) };
  return { message: "If an account exists, a secure reset link has been sent." };
}

export async function updatePassword(_: AuthResult, formData: FormData): Promise<AuthResult> {
  if (!isConfigured()) return { error: "Coursely AI is still connecting its secure account service." };
  const password = stringField(formData, "password");
  const confirmPassword = stringField(formData, "confirmPassword");
  if (password.length < 10) return { error: "Use at least 10 characters for your new password." };
  if (password !== confirmPassword) return { error: "The two passwords do not match." };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Your reset link has expired. Request a new one." };
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: "We could not update your password. Request a fresh reset link." };
  return { message: "Password updated. You can now choose what you would like to do." };
}

export async function signOut() {
  if (!isConfigured()) redirect("/");
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
