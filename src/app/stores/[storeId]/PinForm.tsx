"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { submitPin } from "./actions";

export function PinForm({ storeId }: { storeId: string }) {
  const router = useRouter();
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  const submit = (value: string) =>
    start(async () => {
      const res = await submitPin(storeId, value);
      if (res.error) {
        setError(res.error);
        setPin("");
        inputRef.current?.focus();
      } else {
        router.refresh();
      }
    });

  return (
    <form
      className="card space-y-4 p-6 text-center"
      onSubmit={(e) => {
        e.preventDefault();
        if (pin.length === 4) submit(pin);
      }}
    >
      <div>
        <h2 className="text-lg font-semibold">Enter store PIN</h2>
        <p className="text-sm text-gray-500">Your phone will remember it.</p>
      </div>
      <input
        ref={inputRef}
        className="input mx-auto block w-44 text-center text-3xl tracking-[0.5em] tabular"
        inputMode="numeric"
        pattern="[0-9]*"
        autoComplete="off"
        maxLength={4}
        aria-label="Store PIN"
        placeholder="••••"
        autoFocus
        disabled={pending}
        value={pin}
        onChange={(e) => {
          const v = e.target.value.replace(/\D/g, "").slice(0, 4);
          setPin(v);
          setError(null);
          if (v.length === 4) submit(v); // no extra tap needed
        }}
      />
      {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
      <button className="btn btn-primary w-full" disabled={pending || pin.length !== 4}>
        {pending ? "Checking…" : "Continue"}
      </button>
      <p className="text-xs text-gray-500">Don&apos;t know it? Ask upper management.</p>
    </form>
  );
}
