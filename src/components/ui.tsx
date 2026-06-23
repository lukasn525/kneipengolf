"use client";

import { ButtonHTMLAttributes, InputHTMLAttributes } from "react";

export function Button({
  className = "",
  variant = "primary",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" | "danger" }) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 font-semibold transition disabled:opacity-40 disabled:cursor-not-allowed";
  const styles = {
    primary: "bg-bernstein text-[#2a1d0a] hover:brightness-105 active:brightness-95",
    ghost: "bg-nacht-3 text-schaum hover:bg-[#37291c] border border-[var(--linie)]",
    danger: "bg-ziegel text-schaum hover:brightness-110",
  }[variant];
  return <button className={`${base} ${styles} ${className}`} {...props} />;
}

export function Input({ className = "", ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`w-full rounded-xl bg-nacht-2 border border-[var(--linie)] px-4 py-3 text-schaum placeholder:text-schaum/40 focus:outline-none focus:border-bernstein ${className}`}
      {...props}
    />
  );
}

export function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl bg-nacht-2 border border-[var(--linie)] p-5 shadow-xl ${className}`}
    >
      {children}
    </div>
  );
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm text-schaum/70">{label}</span>
      {children}
    </label>
  );
}

export function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-md px-4 py-6 min-h-dvh flex flex-col">{children}</main>
  );
}

export function Logo({ klein = false }: { klein?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-2xl">🍺</span>
      <span className={`font-display font-extrabold ${klein ? "text-lg" : "text-2xl"}`}>
        Kneipen-Golf
      </span>
    </div>
  );
}
