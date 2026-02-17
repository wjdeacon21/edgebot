"use client";

import { useEffect, useState } from "react";

export function useUserRole() {
  const [role, setRole] = useState<"ops_reviewer" | "admin" | null>(null);

  useEffect(() => {
    fetch("/api/me")
      .then((res) => res.json())
      .then((data) => setRole(data.role ?? "ops_reviewer"))
      .catch(() => setRole("ops_reviewer"));
  }, []);

  const isAdmin = role === "admin";

  return { role, isAdmin };
}
