"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

type Role = "admin" | "visitor";

interface AuthContextType {
  isAdmin: boolean;
  role: Role;
  login: (pin: string) => Promise<boolean>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({
  isAdmin: false,
  role: "visitor",
  login: async () => false,
  logout: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [role, setRole] = useState<Role>("visitor");

  useEffect(() => {
    const savedRole = localStorage.getItem("scheduler_role");
    const expiry = localStorage.getItem("scheduler_expiry");
    if (savedRole === "admin" && expiry && Date.now() < parseInt(expiry)) {
      setRole("admin");
    } else {
      // Clear expired session
      if (savedRole) {
        localStorage.removeItem("scheduler_role");
        localStorage.removeItem("scheduler_expiry");
      }
      setRole("visitor");
    }
  }, []);

  const login = async (pin: string): Promise<boolean> => {
    const res = await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin }),
    });
    if (res.ok) {
      const expiry = Date.now() + 24 * 60 * 60 * 1000;
      localStorage.setItem("scheduler_role", "admin");
      localStorage.setItem("scheduler_expiry", String(expiry));
      setRole("admin");
      return true;
    }
    return false;
  };

  const logout = () => {
    localStorage.removeItem("scheduler_role");
    localStorage.removeItem("scheduler_expiry");
    setRole("visitor");
  };

  return (
    <AuthContext.Provider value={{ isAdmin: role === "admin", role, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
