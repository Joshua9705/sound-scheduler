"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

export type Role = "admin" | "scheduler" | "visitor";

interface AuthContextType {
  isAdmin: boolean;
  isScheduler: boolean;  // scheduler OR admin
  role: Role;
  login: (pin: string) => Promise<boolean>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({
  isAdmin: false,
  isScheduler: false,
  role: "visitor",
  login: async () => false,
  logout: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [role, setRole] = useState<Role>("visitor");

  useEffect(() => {
    const savedRole = localStorage.getItem("scheduler_role") as Role | null;
    const expiry = localStorage.getItem("scheduler_expiry");
    if (savedRole && (savedRole === "admin" || savedRole === "scheduler") && expiry && Date.now() < parseInt(expiry)) {
      setRole(savedRole);
    } else {
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
      const data = await res.json();
      const returnedRole = data.role as Role;
      const expiry = Date.now() + 24 * 60 * 60 * 1000;
      localStorage.setItem("scheduler_role", returnedRole);
      localStorage.setItem("scheduler_expiry", String(expiry));
      setRole(returnedRole);
      return true;
    }
    return false;
  };

  const logout = () => {
    localStorage.removeItem("scheduler_role");
    localStorage.removeItem("scheduler_expiry");
    setRole("visitor");
  };

  const isAdmin = role === "admin";
  const isScheduler = role === "admin" || role === "scheduler";

  return (
    <AuthContext.Provider value={{ isAdmin, isScheduler, role, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
