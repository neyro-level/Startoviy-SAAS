"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { PublicProjectIdentity } from "../../platform/config/identity-contract.ts";

const IdentityContext = createContext<PublicProjectIdentity | null>(null);

export function ProjectIdentityProvider({ identity, children }: { identity: PublicProjectIdentity; children: ReactNode }) {
  return <IdentityContext.Provider value={identity}>{children}</IdentityContext.Provider>;
}

export function useProjectIdentity(): PublicProjectIdentity {
  const identity = useContext(IdentityContext);
  if (!identity) throw new Error("Project identity provider is required");
  return identity;
}
