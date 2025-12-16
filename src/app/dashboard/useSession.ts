import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export interface SessionUser {
    id: string;
    phoneNumber: string;
  }


export function useSession({ onSuccess, onFinishLoading }: { onSuccess?: () => Promise<void>, onFinishLoading?: () => void } = {}) {
    const router = useRouter();
    const [user, setUser] = useState<SessionUser | null>(null);

    useEffect(() => {
        async function checkAuth() {
          try {
            const res = await fetch("/api/auth/session");
            const data = await res.json();

            if (!data.authenticated) {
              router.push("/");
              return;
            }

            setUser(data.user);
            await onSuccess?.();
          } catch {
            router.push("/");
          } finally {
            onFinishLoading?.();
          }
        }

        checkAuth();
      }, [router, onSuccess, onFinishLoading]);

    return { user };
}
