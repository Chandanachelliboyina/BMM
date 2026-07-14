import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { getSignedUrl } from "@/lib/storage";

export type Employee = Tables<"employees">;

export function useSession() {
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUserId(data.session?.user.id ?? null);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUserId(session?.user.id ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  return { userId, loading };
}

export function useEmployee() {
  const { userId, loading: sessionLoading } = useSession();
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    if (!userId) {
      setEmployee(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await supabase.from("employees").select("*").eq("user_id", userId).maybeSingle();
    setEmployee(data);
    if (data?.profile_photo) {
      setPhotoUrl(await getSignedUrl("profile-photos", data.profile_photo));
    } else {
      setPhotoUrl(null);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (!sessionLoading) refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, sessionLoading]);

  return { employee, photoUrl, loading: loading || sessionLoading, refresh };
}
