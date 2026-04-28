"use client";

import { useEffect } from "react";
import { getSession } from "@/lib/auth-session";

export default function Home() {
  useEffect(() => {
    const session = getSession();
    if (session?.accessToken) {
      window.location.replace("/dashboard");
      return;
    }

    window.location.replace("/login");
  }, []);

  return null;
}
